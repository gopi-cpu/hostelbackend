const express = require("express");
const router = express.Router();
const Student = require("../models/student");
const authUser = require("../models/authUser");


// =======================
// ➕ Add new student
// POST /students
// =======================
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      room,
      studentId,
      hostelId,
      emergencyContact,
      createUserAccount = false, // Flag to create user account
      password // Only needed if creating user account
    } = req.body;
    console.log('coming')
    console.log('fields',name,email,phone,room,studentId,hostelId)
    // Validate required fields
    if (!name || !email || !phone || !room || !studentId || !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled'
      });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [{ email }, { studentId }]
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'Student with this email or ID already exists'
      });
    }

    let userId = null;

    // Create user account if requested
    if (createUserAccount) {
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      
      if (existingUser) {
        // Use existing user
        userId = existingUser._id;
      } else {
        if (!password) {
          return res.status(400).json({
            success: false,
            message: 'Password is required to create user account'
          });
        }

        // Create new user
        const user = new authUser({
          name,
          email,
          phone,
          password,
          isVerified: true // Auto-verify for admin-created accounts
        });
        console.log('user',user)

        await user.save();
        userId = user._id;
      }
    }

    // Create student
    const student = new Student({
      name,
      email,
      phone,
      room,
      studentId,
      hostelId,
      emergencyContact: emergencyContact || {},
      user: userId
    });

    await student.save();

    res.status(201).json({
      success: true,
      message: createUserAccount ? 
        'Student and user account created successfully' : 
        'Student created successfully',
      student
    });

  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


// =======================
// 📋 Get all students
// GET /students
// =======================
router.get('/', async (req, res) => {
  try {
    const { hostelId } = req.query;
    console.log('hosteld',hostelId)
    let query = {};
    if (hostelId) {
      query.hostelId = hostelId;
    }

    const students = await Student.find(query)
      .populate('hostelId', 'name')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      students,
      count: students.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});




// =======================
// 🔍 Search students
// GET /students/search?q=
// =======================
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const students = await Student.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { studentId: { $regex: q, $options: "i" } },
      ],
    });

    res.status(200).json({
      success: true,
      students,
      count: students.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


// =======================
// 👤 Get student by ID
// GET /students/:id
// =======================
router.get("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

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
// PUT /students/:id
// =======================
router.put("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

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
// ❌ Delete student
// DELETE /students/:id
// =======================
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
