// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
    // Removed unique: true - uniqueness should be per-hostel or handled via user account
  },
  phone: {
    type: String,
    required: true
  },
   room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },   
    bedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
   bedNumber: String, 
  roomNumber: String,
  studentId: {
    type: String,
    required: true
    // Not unique globally - combine with hostelId for uniqueness
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true
  },
  // Composite unique index: One studentId per hostel
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  checkInDate: {
    type: Date,
    default: Date.now
  },
  checkOutDate: Date,
  status: {
    type: String,
    enum: ['active', 'checked-out', 'suspended', 'transferred'],
    default: 'active'
  },
  userId: {  // Renamed from 'user' for clarity
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  // Track if this student record was created by admin (has login) or is just a record
  hasLoginAccess: {
    type: Boolean,
    default: false
  },
  // Add to studentSchema in models/Student.js
  bookingRef: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Booking',
  default: null
},
source: {
  type: String,
  enum: ['direct-admin', 'booking-system', 'import'],
  default: 'direct-admin'
},
  createdBy: {
    type: String,
    enum: ['self-registration', 'admin', 'booking-system'],
    default: 'admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index: studentId must be unique within a hostel
studentSchema.index({ studentId: 1, hostelId: 1 }, { unique: true });
// Index for finding students by user
studentSchema.index({ userId: 1, status: 1 });


module.exports = mongoose.model('Student', studentSchema);