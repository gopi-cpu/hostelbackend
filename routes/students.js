const express = require("express");
const router = express.Router();
const Student = require("../models/tenants");
const User = require("../models/authUser");
const Booking = require("../models/bookingschema");
const Room = require('../models/roomSchema');
const crypto = require('crypto');

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
// IMPORTANT: Must be BEFORE /:id
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
// 📱 NEW: Check phone exists
// GET /api/students/check-phone?phone=xxx
// IMPORTANT: Must be BEFORE /:id
// =======================
router.get('/check-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const user = await User.findOne({ phone: phone.trim() })
      .select('name email phone studentProfiles');

    res.json({
      success: true,
      exists: !!user,
      user: user ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        existingHostels: user.studentProfiles?.length || 0
      } : null
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
// IMPORTANT: Must be BEFORE /:id
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

// =======================
// ➕ Add new student (Phone-based flow)
// POST /api/students
// 
// FLOW:
// 1. Check if user exists by PHONE NUMBER
// 2. If NO user exists → Create new user account
// 3. If user exists → Use existing user
// 4. Check if user is already tenant in this hostel
// 5. Create tenant record linked to user
// =======================
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,          // REQUIRED - used to check existing user
      room,           // Room ObjectId
      roomNumber,     // Room number string
      bedNumber,      // Bed number string
      hostelId,
      emergencyContact,
      password,       // Optional: auto-generated if not provided
      dateOfBirth,
      gender,
      address,
      course,
      department,
      notifyUser = true,
      source = 'direct-admin'
    } = req.body;

    console.log('Creating student:', { name, phone, email, hostelId, roomNumber, bedNumber });

    // 1️⃣ Validate required fields
    if (!name || !phone || !email || !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, phone, email, hostelId'
      });
    }

    // 2️⃣ Check/Create User by PHONE NUMBER
    let user = await User.findOne({ phone: phone.trim() });
    let isNewUser = false;
    let generatedPassword = null;

    if (!user) {
      // 🆕 CREATE NEW USER
      isNewUser = true;
      generatedPassword = password || generateTempPassword();
      
      // Check if email already exists (for different phone - data conflict)
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered with different phone number'
        });
      }

      user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: generatedPassword,
        role: 'student',
        isVerified: true,
        createdBy: 'admin'
      });

      await user.save();
      console.log(`✅ New user created: ${user._id} with phone ${phone}`);
    } else {
      // 👤 USER EXISTS
      console.log(`👤 Existing user found: ${user._id} with phone ${phone}`);
    }

    // 3️⃣ Check if already tenant in this hostel
    const existingTenant = await Student.findOne({ 
      userId: user._id, 
      hostelId: hostelId,
      status: { $in: ['active', 'suspended'] }
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'This user is already a tenant in your hostel',
        existingTenantId: existingTenant._id,
        userId: user._id
      });
    }

    // 4️⃣ Room + Bed Assignment
    let assignedRoomId = null;
    let assignedRoomNumber = null;
    let assignedBedNumber = null;
    let assignedBedId = null;

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

      if (bedNumber) {
        const foundBed = foundRoom.beds.find(bed => bed.bedNumber === bedNumber);

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

        foundBed.isOccupied = true;
        foundBed.status = "occupied";
        assignedBedId = foundBed._id;
        assignedBedNumber = foundBed.bedNumber;

        await foundRoom.save();
      }
    }

    // 5️⃣ Create Tenant Record
    const student = new Student({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      room: assignedRoomId,
      roomNumber: assignedRoomNumber,
      bedId: assignedBedId,
      bedNumber: assignedBedNumber,
      hostelId,
      userId: user._id,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      address: address || null,
      course: course || null,
      department: department || null,
      emergencyContact: emergencyContact || {},
      hasLoginAccess: true,
      status: 'active',
      source,
      createdBy: 'admin',
      checkInDate: assignedRoomId ? new Date() : null
    });

    await student.save();

    // Add to user's student profiles
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { studentProfiles: student._id }
    });

    // 6️⃣ Return Response
    const responseData = {
      success: true,
      message: isNewUser 
        ? 'New user account created and tenant added successfully' 
        : 'Existing user linked and tenant added successfully',
      student: await Student.findById(student._id)
        .populate('userId', 'name email phone')
        .populate('room', 'roomNumber floor'),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    };

    if (isNewUser) {
      responseData.temporaryPassword = generatedPassword;
    }

    res.status(201).json(responseData);

  } catch (error) {
    console.error('Create student error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry: This user is already a tenant in this hostel',
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
// THIS MUST BE AFTER all specific routes
// =======================qq
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('hostelId', 'name address amenities')
      .populate('userId', 'name email phone profileImage');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
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

    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.userId;
    delete updateData.hostelId;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('userId', 'name email phone')
    .populate('hostelId', 'name');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
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
// ❌ Delete student (Soft delete)
// DELETE /api/students/:id
// =======================
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { status: 'checked-out', checkOutDate: new Date() },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    // Free up the bed if assigned
    if (student.room && student.bedId) {
      await Room.findOneAndUpdate(
        { _id: student.room, 'beds._id': student.bedId },
        { $set: { 'beds.$.isOccupied': false, 'beds.$.status': 'available' } }
      );
    }

    // Remove from user's studentProfiles
    if (student.userId) {
      await User.findByIdAndUpdate(student.userId, {
        $pull: { studentProfiles: student._id }
      });
    }

    res.status(200).json({
      success: true,
      message: "Tenant checked out successfully",
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
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    student.userId = userId;
    student.hasLoginAccess = true;
    await student.save();

    await User.findByIdAndUpdate(userId, {
      $addToSet: { studentProfiles: studentId }
    });

    res.json({
      success: true,
      message: 'User linked to tenant successfully',
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
// 🔧 Helper: Generate temporary password
// =======================
function generateTempPassword(length = 8) {
  return crypto.randomBytes(length).toString('base64').slice(0, length).replace(/[^a-zA-Z0-9]/g, '9');
}

module.exports = router;