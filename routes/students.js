const express = require('express');
const router = express.Router();
const Student = require('../models/student');

// Add new student
router.post('/add', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      room,
      studentId,
      emergencyContact,
      userId // optional
    } = req.body;

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

    // Create new student
    const student = new Student({
      name,
      email,
      phone,
      room,
      studentId,
      emergencyContact,
      user: userId || null
    });

    await student.save();

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      student
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all students
router.get('/get', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;