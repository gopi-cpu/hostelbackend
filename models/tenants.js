// models/Tenants.js
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Basic Info
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
  },
  phone: {
    type: String,
    required: true
  },
  
  // Room Assignment
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
  
  // Hostel & User Links
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  
  // Dates
  checkInDate: {
    type: Date,
    default: Date.now
  },
  checkOutDate: Date,
  
  // Status
  status: {
    type: String,
    enum: ['active', 'checked-out', 'suspended', 'transferred'],
    default: 'active',
    index: true
  },
  
  // Login Access
  hasLoginAccess: {
    type: Boolean,
    default: true
  },
  
  // Booking Reference
  bookingRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  
  // Source Tracking
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
  
  // ==========================================
  // 💰 RENT PAYMENT TRACKING (NEW)
  // ==========================================
  
  monthlyRent: {
    type: Number,
    default: 0,
    min: 0
  },
  
  securityDeposit: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Payment Schedule
  rentDueDay: {
    type: Number, // Day of month (1-31) when rent is due
    default: 1,
    min: 1,
    max: 31
  },
   currentMonthStatus: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'partial', 'waived'],
    default: 'pending'
  },
   isPaymentVerified: {
    type: Boolean,
    default: false
  },
   lastVerification: {
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationMethod: {
      type: String,
      enum: ['cash', 'upi_screenshot', 'bank_transfer', 'auto']
    },
    receiptNumber: String
  },
  
lastPaymentDate: {
  type: Date,
  default: null
},

paymentMode: {
  type: String,
  enum: ['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other'],
  default: 'cash'
},

transactionId: String,
notes: String,

recordedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
},
  
  remindersSent: [{
    sentAt: {
      type: Date,
      default: Date.now
    },
    message: String,
    channels: [{
      type: String,
      enum: ['sms', 'email', 'push', 'whatsapp']
    }],
    amount: Number,
    status: {
      type: String,
      enum: ['sent', 'failed', 'delivered', 'read'],
      default: 'sent'
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: {
      ipAddress: String,
      userAgent: String
    }
  }],
  
  lastReminderSent: {
    type: Date,
    default: null
  },
  
  reminderCount: {
    type: Number,
    default: 0
  },
  
  // Auto-reminder settings
  autoReminderEnabled: {
    type: Boolean,
    default: true
  },
  
  reminderPreference: {
    type: String,
    enum: ['sms', 'email', 'both', 'none'],
    default: 'both'
  },
  
  // ==========================================
  // Meta
  // ==========================================
  
  notes: String, // Internal notes for owner
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ==========================================
// INDEXES
// ==========================================

// Compound index: One user can only be tenant once per hostel
tenantSchema.index({ userId: 1, hostelId: 1 }, { unique: true });

// Index for finding tenants by user
tenantSchema.index({ userId: 1, status: 1 });

// Index for phone lookups
tenantSchema.index({ phone: 1 });

// ==========================================
// MIDDLEWARE
// ==========================================

// Pre-save middleware
tenantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  next();
});


// ==========================================
// STATIC METHODS
// ==========================================

// Get all tenants with due/overdue rent
tenantSchema.statics.getDueTenants = function(hostelId, options = {}) {
  const { overdueOnly = false, daysBeforeDue = 3 } = options;
  
  const query = {
    status: 'active',
    autoReminderEnabled: true
  };

  if (hostelId) {
    query.hostelId = hostelId;
  }

  const now = new Date();
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + daysBeforeDue);

 
  return this.find(query)
    .populate('userId', 'name email phone profileImage fcmToken')
    .populate('hostelId', 'name location owner')
    .populate('room', 'roomNumber floor amenities')
};

// Record a payment
tenantSchema.statics.recordPayment = async function(tenantId, paymentData) {
  const tenant = await this.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  
  // Update last payment date
  tenant.lastPaymentDate = paymentData.paidDate || new Date();
  
  // Calculate next payment date (1 month from last due date or today)
 
  nextPayment.setMonth(nextPayment.getMonth() + 1);

  
  // Reset pending amount (or calculate new pending)
  tenant.pendingAmount = Math.max(0, tenant.pendingAmount - paymentData.amount);
  
  await tenant.save();
  return tenant;
};

// Add reminder to tenant record
tenantSchema.methods.addReminder = async function(reminderData) {
  this.remindersSent.push({
    ...reminderData,
    sentAt: new Date()
  });
  this.lastReminderSent = new Date();
  this.reminderCount = (this.reminderCount || 0) + 1;
  return this.save();
};

const Tenants = mongoose.models.Tenants || mongoose.model("Tenants", tenantSchema);

module.exports = Tenants;