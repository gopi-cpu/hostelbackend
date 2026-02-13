const express = require("express");
const router = express.Router();
const Student = require("../models/student");
const User = require("../models/authUser");  // Fixed: Use correct import
const Booking = require("../models/bookingschema");
const Room = require('../models/roomSchema')
// =======================
// 📋 Get all students
// GET /api/students?hostelId=xxx
// =======================
router.get('/', async (req, res) => {
  try {
    const { hostelId } = req.query;
    let query = {};
    
    if (hostelId) {
      query.hostelId = hostelId;
    }

    const students = await Student.find(query)
      .populate('hostelId', 'name address')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      students,
      count: students.length
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// =======================
// 🔍 Search students
// GET /api/students/search?q=xxx&hostelId=xxx
// IMPORTANT: This route must be BEFORE /:id
// =======================
router.get("/search", async (req, res) => {
  try {
    const { q, hostelId } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    let searchQuery = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { studentId: { $regex: q, $options: "i" } },
      ],
    };

    if (hostelId) {
      searchQuery.hostelId = hostelId;
    }

    const students = await Student.find(searchQuery)
      .populate('hostelId', 'name')
      .populate('userId', 'name email');

    res.status(200).json({
      success: true,
      students,
      count: students.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =======================
// ➕ Add new student (Admin creates student)
// POST /api/students
// Cases handled: 
// 1. New user + New student (createUserAccount=true)
// 2. Existing user + New student (link to existing user)
// 3. Just student record (no login)
// =======================
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      room,           // Room ObjectId
      roomNumber,     // Room number string
      bedNumber,      // Bed number string
      studentId,
      hostelId,
      emergencyContact,
      createUserAccount = false,
      password,
      dateOfBirth,
      gender,
      address,
      course,
      department,
      source = 'direct-admin'
    } = req.body;

    console.log('Creating student:', { name, email, studentId, hostelId, roomNumber, bedNumber });

    // ===============================
    // 1️⃣ Validate required fields
    // ===============================
    if (!name || !email || !phone || !studentId || !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, email, phone, studentId, hostelId'
      });
    }

    // ===============================
    // 2️⃣ Check duplicate student in same hostel
    // ===============================
    const existingStudent = await Student.findOne({ studentId, hostelId });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: `Student with ID ${studentId} already exists in this hostel`
      });
    }

    // ===============================
    // 3️⃣ Room + Bed Assignment
    // ===============================
    let assignedRoomId = null;
    let assignedRoomNumber = null;
    let assignedBedNumber = null;

    if (room || roomNumber) {

      let roomQuery = { hostel: hostelId };

      if (room) {
        roomQuery._id = room;
      } else if (roomNumber) {
        roomQuery.roomNumber = roomNumber;
      }

      const foundRoom = await Room.findOne(roomQuery);

      if (!foundRoom) {
        return res.status(400).json({
          success: false,
          message: "Room not found"
        });
      }

      assignedRoomId = foundRoom._id;
      assignedRoomNumber = foundRoom.roomNumber;

      // If bed is provided
      if (bedNumber) {

        const foundBed = foundRoom.beds.find(
          bed => bed.bedNumber === bedNumber
        );

        if (!foundBed) {
          return res.status(400).json({
            success: false,
            message: `Bed ${bedNumber} not found in room ${foundRoom.roomNumber}`
          });
        }

        if (foundBed.isOccupied) {
          return res.status(400).json({
            success: false,
            message: `Bed ${bedNumber} is already occupied`
          });
        }

        // Mark bed occupied
        foundBed.isOccupied = true;
        foundBed.status = "occupied";

        assignedBedNumber = foundBed.bedNumber;

        await foundRoom.save();
      }
    }

    // ===============================
    // 4️⃣ Handle User Account Creation
    // ===============================
    let userId = null;
    let userCreated = false;
    let isExistingUser = false;

    if (createUserAccount) {

      const existingUser = await User.findOne({
        email: email.toLowerCase()
      });

      if (existingUser) {
        userId = existingUser._id;
        isExistingUser = true;
      } else {

        if (!password) {
          return res.status(400).json({
            success: false,
            message: "Password is required to create user account"
          });
        }

        const newUser = new User({
          name,
          email: email.toLowerCase(),
          phone,
          password,
          role: 'student',
          isVerified: true
        });

        await newUser.save();

        userId = newUser._id;
        userCreated = true;
      }
    }

    // ===============================
    // 5️⃣ Create Student Record
    // ===============================
    const student = new Student({
      name,
      email: email.toLowerCase(),
      phone,
      room: assignedRoomId,
      roomNumber: assignedRoomNumber,
      bedNumber: assignedBedNumber,
      studentId,
      hostelId,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      address: address || null,
      course: course || null,
      department: department || null,
      emergencyContact: emergencyContact || {},
      userId,
      hasLoginAccess: !!userId,
      status: 'active',
      source,
      createdBy: 'admin',
      checkInDate: assignedRoomId ? new Date() : null
    });

    await student.save();

    // Link student profile to user
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { studentProfiles: student._id }
      });
    }

    // ===============================
    // 6️⃣ Final Response
    // ===============================
    res.status(201).json({
      success: true,
      message: userCreated
        ? 'Student and new user account created successfully'
        : isExistingUser
          ? 'Student linked to existing user account'
          : 'Student record created (no login)',
      student: await Student.findById(student._id)
        .populate('userId', 'name email')
        .populate('room', 'roomNumber floor')
    });

  } catch (error) {
    console.error('Create student error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry error',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// =======================
// 👤 Get student by ID
// GET /api/students/:id
// =======================
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('hostelId', 'name address amenities')
      .populate('userId', 'name email phone profileImage');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =======================
// ✏️ Update student
// PUT /api/students/:id
// =======================
router.put("/:id", async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    // Don't allow changing critical fields directly
    delete updateData._id;
    delete updateData.createdAt;
    
    // Handle userId linking separately if provided
    if (updateData.linkToUser) {
      const user = await User.findById(updateData.linkToUser);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found to link"
        });
      }
      updateData.userId = user._id;
      updateData.hasLoginAccess = true;
      delete updateData.linkToUser;
      
      // Add to user's student profiles
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { studentProfiles: req.params.id }
      });
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('userId', 'name email')
    .populate('hostelId', 'name');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =======================
// ❌ Delete student (Soft delete recommended)
// DELETE /api/students/:id
// =======================
router.delete("/:id", async (req, res) => {
  try {
    // Option 1: Hard delete (your current approach)
    // const student = await Student.findByIdAndDelete(req.params.id);
    
    // Option 2: Soft delete (recommended)
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { status: 'checked-out', checkOutDate: new Date() },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Remove from user's studentProfiles if linked
    if (student.userId) {
      await User.findByIdAndUpdate(student.userId, {
        $pull: { studentProfiles: student._id }
      });
    }

    res.status(200).json({
      success: true,
      message: "Student checked out successfully",
      student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =======================
// 🔗 Link existing user to student
// POST /api/students/:id/link-user
// =======================
router.post('/:id/link-user', async (req, res) => {
  try {
    const { userId } = req.body;
    const studentId = req.params.id;

    const [student, user] = await Promise.all([
      Student.findById(studentId),
      User.findById(userId)
    ]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update student
    student.userId = userId;
    student.hasLoginAccess = true;
    await student.save();

    // Update user
    await User.findByIdAndUpdate(userId, {
      $addToSet: { studentProfiles: studentId }
    });

    res.json({
      success: true,
      message: 'User linked to student successfully',
      student: await Student.findById(studentId).populate('userId', 'name email')
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// =======================
// 📱 Get student's hostels (for user app)
// GET /api/students/user/:userId/hostels
// =======================
router.get('/user/:userId/hostels', async (req, res) => {
  try {
    const students = await Student.find({ 
      userId: req.params.userId,
      status: 'active'
    })
    .populate('hostelId', 'name address phone amenities')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      hostels: students.map(s => ({
        studentRecordId: s._id,
        hostel: s.hostelId,
        room: s.room,
        studentId: s.studentId,
        checkInDate: s.checkInDate
      })),
      count: students.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;