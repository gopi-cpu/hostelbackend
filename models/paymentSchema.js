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
    ref: 'Property',
    required: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenants',
    index: true
  },
  month: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  
  // UPI Payment Fields - NEW
  upiPayment: {
    enabled: {
      type: Boolean,
      default: true
    },
    ownerUpiId: {
      type: String,
      required: function() {
        return this.upiPayment?.enabled;
      }
    },
    ownerPhone: {
      type: String
    },
    upiTransactionId: {
      type: String,
      index: true
    },
    upiAppUsed: {
      type: String,
      enum: ['phonepe', 'googlepay', 'paytm', 'amazonpay', 'other']
    },
    payerUpiId: {
      type: String
    }
  },
  
  paymentProof: {
    type: String, // URL to screenshot/image of payment
    required: function() {
      return this.paymentMethod === 'upi' && this.upiPayment?.enabled;
    }
  },
  paymentProofUploadedAt: {
    type: Date
  },

  rentAmount: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
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
    enum: ['pending', 'partial', 'paid', 'overdue', 'awaiting_verification'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'upi', 'card', 'direct_upi']
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'not_required'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  verificationNotes: {
    type: String
  },
  transactionId: String,
  receiptNumber: {
    type: String,
    unique: true,
    sparse: true
  },
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

// Generate receipt number before saving
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.receiptNumber && this.paymentStatus === 'paid') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.receiptNumber = `RCP${timestamp}${random}`;
  }
  next();
});

// Pre-save middleware to calculate totals and update payment status
paymentSchema.pre('save', function(next) {
  const additionalTotal = this.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const discountTotal = this.discounts.reduce((sum, discount) => sum + discount.amount, 0);
  
  this.totalAmount = this.rentAmount + this.lateFee + additionalTotal - discountTotal;
  
  // Update payment status based on amount paid
  if (this.amountPaid >= this.totalAmount) {
    this.paymentStatus = this.verificationStatus === 'verified' || this.verificationStatus === 'not_required' 
      ? 'paid' 
      : 'awaiting_verification';
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
paymentSchema.index({ tenant: 1, month: 1, year: 1 }, { unique: true });
paymentSchema.index({ user: 1, paymentStatus: 1 });
paymentSchema.index({ hostel: 1, paymentStatus: 1 });
paymentSchema.index({ 'upiPayment.upiTransactionId': 1 });
paymentSchema.index({ verificationStatus: 1, paymentStatus: 1 });

module.exports = mongoose.model('Payment', paymentSchema);