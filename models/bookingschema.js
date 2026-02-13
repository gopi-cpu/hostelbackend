// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Core References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  bed: { 
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  
  // Student Record Link (Created after check-in)
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null  // Populated when booking is converted to student record
  },

  // Dates
  checkInDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkOutDate: {
    type: Date,
    required: true
  },
  actualCheckIn: Date,  // When owner actually checked them in
  actualCheckOut: Date, // When owner actually checked them out

  // Financial Details
  rentAmount: {
    type: Number,
    required: true
  },
  securityDeposit: {
    type: Number,
    default: 0
  },
  depositPaid: {
    type: Boolean,
    default: false
  },
  advancePayment: {
    amount: { type: Number, default: 0 },
    months: { type: Number, default: 0 },
    paidDate: Date
  },
  totalAmount: {  // Calculated field
    type: Number,
    required: true
  },
  pendingAmount: {
    type: Number,
    default: 0
  },

  // Status Management
  status: {
    type: String,
    enum: [
      'pending',      // Booking created, awaiting confirmation
      'confirmed',    // Owner confirmed, awaiting check-in
      'checkedIn',    // Student has checked in (active stay)
      'checkedOut',   // Student checked out normally
      'cancelled',    // Cancelled before check-in
      'completed',    // Stay completed successfully
      'noShow',       // Didn't show up
      'terminated'    // Kicked out/early termination
    ],
    default: 'pending',
    index: true
  },

  // Emergency Contact
  emergencyContact: {
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true }
  },

  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['aadhar', 'pan', 'college_id', 'photo', 'agreement', 'other'],
      required: true
    },
    url: { type: String, required: true },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Review System
  canReview: {
    type: Boolean,
    default: false
  },
  reviewSubmitted: {
    type: Boolean,
    default: false
  },

  // Cancellation Details
  cancelledAt: Date,
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Meta
  notes: String,  // Internal notes for owner/admin
  createdBy: {
    type: String,
    enum: ['user-booking', 'admin-booking', 'walk-in'],
    default: 'user-booking'
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

// Pre-save middleware
bookingSchema.pre('save', function(next) {
  // Update canReview logic
  const completedStatuses = ['completed', 'checkedOut'];
  const isCompleted = completedStatuses.includes(this.status);
  const stayEnded = this.checkOutDate < new Date() || this.actualCheckOut;
  this.canReview = isCompleted && stayEnded && !this.reviewSubmitted;
  
  // Update timestamps
  this.updatedAt = Date.now();
  
  // Calculate pending amount
  if (this.isModified('totalAmount') || this.isModified('advancePayment')) {
    const paid = (this.advancePayment?.amount || 0) + (this.depositPaid ? this.securityDeposit : 0);
    this.pendingAmount = this.totalAmount - paid;
  }
  
  next();
});

// Virtual for duration
bookingSchema.virtual('durationDays').get(function() {
  return Math.ceil((this.checkOutDate - this.checkInDate) / (1000 * 60 * 60 * 24));
});

bookingSchema.virtual('durationMonths').get(function() {
  return Math.ceil(this.durationDays / 30);
});

// Static method to convert booking to student
bookingSchema.statics.convertToStudent = async function(bookingId) {
  const Booking = this;
  const Student = mongoose.model('Student');
  const User = mongoose.model('User');
  
  const booking = await Booking.findById(bookingId)
    .populate('user', 'name email phone')
    .populate('hostel', 'name');
    
  if (!booking) throw new Error('Booking not found');
  if (booking.student) throw new Error('Already converted to student');
  
  // Generate student ID (customize as needed)
  const studentId = `STU-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  const student = new Student({
    name: booking.user.name,
    email: booking.user.email,
    phone: booking.user.phone,
    room: booking.room.toString(), // You might want to populate room number
    studentId: studentId,
    hostelId: booking.hostel,
    userId: booking.user._id,
    emergencyContact: booking.emergencyContact,
    checkInDate: booking.actualCheckIn || booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    hasLoginAccess: true,
    createdBy: 'booking-system',
    status: 'active',
    bookingRef: booking._id
  });
  
  await student.save();
  
  // Update booking with student reference
  booking.student = student._id;
  await booking.save();
  
  // Add to user's student profiles
  await User.findByIdAndUpdate(booking.user._id, {
    $addToSet: { studentProfiles: student._id }
  });
  
  return student;
};

// Indexes for performance
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ hostel: 1, status: 1 });
bookingSchema.index({ room: 1, bed: 1, status: 1 }); // For checking availability
bookingSchema.index({ checkInDate: 1, checkOutDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);