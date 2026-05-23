const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: false
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
    },
    paymentProofUrl: String, // Screenshot
    paymentProofUploadedAt: Date
  },
  
  paymentProof: {
    type: String, // URL to screenshot/image of payment
    default:null,
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
  if (this.isNew && !this.receiptNumber) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.receiptNumber = `RCP${timestamp}${random}`;
  }
  next();
});
paymentSchema.pre('save', function (next) {
  try {
    // ✅ Safe defaults (avoid crash)
    const additionalCharges = this.additionalCharges || [];
    const discounts = this.discounts || [];

    const additionalTotal = additionalCharges.reduce(
      (sum, charge) => sum + (charge.amount || 0),
      0
    );

    const discountTotal = discounts.reduce(
      (sum, discount) => sum + (discount.amount || 0),
      0
    );

    // ✅ Calculate total amount
    this.totalAmount =
      (this.rentAmount || 0) +
      (this.lateFee || 0) +
      additionalTotal -
      discountTotal;

    // ✅ PAYMENT STATUS LOGIC (FIXED 🚀)

    // 🟢 1. Fully paid
    if (this.amountPaid >= this.totalAmount && this.totalAmount > 0) {
      this.paymentStatus =
        this.verificationStatus === 'verified' ||
        this.verificationStatus === 'not_required'
          ? 'paid'
          : 'awaiting_verification';
    }

    // 🟡 2. Partial payment
    else if (this.amountPaid > 0 && this.amountPaid < this.totalAmount) {
      this.paymentStatus = 'partial';
    }

    // 🔴 3. NEW BILL → ALWAYS PENDING (IMPORTANT FIX)
    else if (this.isNew) {
      this.paymentStatus = 'pending';
    }

    // 🔴 4. Existing bill → check overdue
    else if (new Date() > this.dueDate) {
      this.paymentStatus = 'overdue';
    }

    // ⚪ 5. Default fallback
    else {
      this.paymentStatus = 'pending';
    }

    // ✅ Update timestamp
    this.updatedAt = Date.now();

    next();
  } catch (error) {
    next(error);
  }
});

// Index for better query performance
paymentSchema.index({ tenant: 1, month: 1, year: 1 }, { unique: true });
paymentSchema.index({ user: 1, paymentStatus: 1 });
paymentSchema.index({ hostel: 1, paymentStatus: 1 });
paymentSchema.index({ 'upiPayment.upiTransactionId': 1 });
paymentSchema.index({ verificationStatus: 1, paymentStatus: 1 });

module.exports = mongoose.model('Payment', paymentSchema);