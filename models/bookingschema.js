const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
   bed: { type: mongoose.Schema.Types.ObjectId },
  checkInDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  checkOutDate: {
    type: Date
  },
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
    amount: Number,
    months: Number,
    paidDate: Date
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed', 'checkedIn', 'checkedOut'],
    default: 'confirmed'
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  documents: [{
    type: {
      type: String,
      enum: ['aadhar', 'pan', 'college_id', 'photo', 'agreement']
    },
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  canReview: {
    type: Boolean,
    default: function() {
      const completedStatus = ['completed', 'checkedOut'].includes(this.status);
      const stayCompleted = this.checkOutDate < new Date();
      return completedStatus && stayCompleted;
    }
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

// Update canReview field before saving
bookingSchema.pre('save', function(next) {
  const completedStatus = ['completed', 'checkedOut'].includes(this.status);
  const stayCompleted = this.checkOutDate < new Date();
  this.canReview = completedStatus && stayCompleted;
  this.updatedAt = Date.now();
  next();
});

// Virtual for duration of stay in days
bookingSchema.virtual('duration').get(function() {
  return Math.ceil((this.checkOutDate - this.checkInDate) / (1000 * 60 * 60 * 24));
});

// Index for better query performance
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ hostel: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);