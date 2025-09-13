const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
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
  month: {
    type: String,
    required: true
  },
  rentAmount: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidDate: {
    type: Date
  },
  lateFee: {
    type: Number,
    default: 0
  },
  additionalCharges: [{
    description: String,
    amount: Number,
    date: Date
  }],
  discounts: [{
    description: String,
    amount: Number,
    reason: String
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'upi', 'card']
  },
  transactionId: String,
  receiptNumber: String,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Pre-save middleware to calculate totals and update payment status
paymentSchema.pre('save', function(next) {
  const additionalTotal = this.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const discountTotal = this.discounts.reduce((sum, discount) => sum + discount.amount, 0);
  
  this.totalAmount = this.rentAmount + this.lateFee + additionalTotal - discountTotal;
  
  // Update payment status
  if (this.amountPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else if (this.amountPaid > 0) {
    this.paymentStatus = 'partial';
  } else if (new Date() > this.dueDate) {
    this.paymentStatus = 'overdue';
  } else {
    this.paymentStatus = 'pending';
  }
  
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
paymentSchema.index({ booking: 1, month: 1 }, { unique: true });
paymentSchema.index({ user: 1, paymentStatus: 1 });
paymentSchema.index({ hostel: 1, paymentStatus: 1 });

module.exports = mongoose.model('Payment', paymentSchema);