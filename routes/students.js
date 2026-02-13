const express = require("express");
const router = express.Router();
const Student = require("../models/student");
const User = require("../models/authUser");  // Fixed: Use correct import
const Booking = require("../models/bookingschema");

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
      roomNumber,     // Room number string (e.g., "101")
      bedId,          // Bed ObjectId
      bedNumber,      // Bed number string (e.g., "A", "1")
      studentId,
      hostelId,
      emergencyContact,
      createUserAccount = false,
      password,
      sendCredentials = false,
      dateOfBirth,
      gender,
      address,
      course,
      department,
      source = 'direct-admin'
    } = req.body;

    console.log('Creating student:', { name, email, studentId, hostelId, roomNumber, bedNumber });

    // Validate required fields
    if (!name || !email || !phone || !studentId || !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, email, phone, studentId, hostelId'
      });
    }

    // Check if student already exists in THIS hostel
    const existingStudentInHostel = await Student.findOne({
      studentId,
      hostelId
    });

    if (existingStudentInHostel) {
      return res.status(400).json({
        success: false,
        message: `Student with ID ${studentId} already exists in this hostel`
      });
    }

    // If room is provided, validate it exists and has available beds
    let assignedRoomId = room || null;
    let assignedRoomNumber = roomNumber || null;
    let assignedBedId = bedId || null;
    let assignedBedNumber = bedNumber || null;

    if (room || roomNumber) {
      // Find room by ID or roomNumber
      let roomQuery = { hostelId };
      
      if (room && /^[0-9a-fA-F]{24}$/.test(room)) {
        roomQuery._id = room;
      } else if (roomNumber) {
        roomQuery.roomNumber = roomNumber;
      } else {
        roomQuery._id = room;
      }

      const foundRoom = await Room.findOne(roomQuery);
      
      if (!foundRoom) {
        return res.status(400).json({
          success: false,
          message: `Room ${roomNumber || room} not found in this hostel`
        });
      }

      assignedRoomId = foundRoom._id;
      assignedRoomNumber = foundRoom.roomNumber;

      // Check if specific bed is requested
      if (bedId || bedNumber) {
        const bedQuery = { roomId: foundRoom._id };
        
        if (bedId && /^[0-9a-fA-F]{24}$/.test(bedId)) {
          bedQuery._id = bedId;
        } else if (bedNumber) {
          bedQuery.bedNumber = bedNumber;
        } else {
          bedQuery._id = bedId;
        }

        const foundBed = await Bed.findOne(bedQuery);

        if (!foundBed) {
          return res.status(400).json({
            success: false,
            message: `Bed ${bedNumber || bedId} not found in room ${foundRoom.roomNumber}`
          });
        }

        if (foundBed.isOccupied) {
          return res.status(400).json({
            success: false,
            message: `Bed ${foundBed.bedNumber} is already occupied`
          });
        }

        // Mark bed as occupied
        foundBed.isOccupied = true;
        foundBed.checkInDate = new Date();
        await foundBed.save();

        assignedBedId = foundBed._id;
        assignedBedNumber = foundBed.bedNumber;
      }
    }

    let userId = null;
    let userCreated = false;
    let isExistingUser = false;

    // Handle user account creation/linking
    if (createUserAccount) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      
      if (existingUser) {
        userId = existingUser._id;
        isExistingUser = true;
        
        const existingLink = await Student.findOne({
          userId: existingUser._id,
          hostelId,
          status: 'active'
        });

        if (existingLink) {
          // Rollback bed assignment if user already linked
          if (assignedBedId) {
            await Bed.findByIdAndUpdate(assignedBedId, {
              isOccupied: false,
              occupiedBy: null,
              checkInDate: null
            });
          }
          
          return res.status(400).json({
            success: false,
            message: 'This user is already an active student in this hostel'
          });
        }
      } else {
        if (!password) {
          // Rollback bed assignment if validation fails
          if (assignedBedId) {
            await Bed.findByIdAndUpdate(assignedBedId, {
              isOccupied: false,
              occupiedBy: null,
              checkInDate: null
            });
          }

          return res.status(400).json({
            success: false,
            message: 'Password is required to create user account'
          });
        }

        const newUser = new User({
          name,
          email: email.toLowerCase(),
          phone,
          password, // Make sure to hash this in User model pre-save
          role: 'student',
          isVerified: true
        });

        await newUser.save();
        userId = newUser._id;
        userCreated = true;
      }
    }

    // Create student record with room and bed info
    const student = new Student({
      name,
      email: email.toLowerCase(),
      phone,
      room: assignedRoomId,
      roomNumber: assignedRoomNumber,
      bedId: assignedBedId,
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
      createdBy: userId ? 'admin' : 'admin',
      checkInDate: assignedRoomId ? new Date() : null
    });

    await student.save();

    // Update bed with student reference
    if (assignedBedId) {
      await Bed.findByIdAndUpdate(assignedBedId, {
        occupiedBy: student._id,
        studentName: name,
        studentEmail: email
      });
    }

    // If linked to user, add student reference to user's profile
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { studentProfiles: student._id }
      });
    }

    res.status(201).json({
      success: true,
      message: userCreated 
        ? 'Student and new user account created successfully' 
        : isExistingUser 
          ? 'Student linked to existing user account' 
          : 'Student record created (no login)',
      student: await Student.findById(student._id)
        .populate('userId', 'name email')
        .populate('hostelId', 'name')
        .populate('room', 'roomNumber floor')
    });

  } catch (error) {
    console.error('Create student error:', error);
    
    // Attempt to rollback bed assignment on error
    if (req.body.bedId || req.body.bedNumber) {
      try {
        const bed = await Bed.findOne({
          $or: [
            { _id: req.body.bedId },
            { bedNumber: req.body.bedNumber, roomId: req.body.room }
          ]
        });
        if (bed) {
          bed.isOccupied = false;
          bed.occupiedBy = null;
          bed.checkInDate = null;
          await bed.save();
        }
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry: Student ID already exists in this hostel or email conflict',
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