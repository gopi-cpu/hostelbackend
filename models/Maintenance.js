// models/Maintenance.js (Enhanced version)
const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true
  },
  room: {
    type: String,
    required: true,
    trim: true
  },
  bed: {
    type: String,
    trim: true
  },
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Track if raised by student profile
  studentProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  },
  category: {
    type: String,
    enum: ['electrical', 'plumbing', 'carpentry', 'cleaning', 'furniture', 'appliance', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  images: [{
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'],
    default: 'pending',
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Cost tracking
  estimatedCost: {
    type: Number,
    min: 0
  },
  actualCost: {
    type: Number,
    min: 0
  },
  // Timeline tracking
  scheduledDate: Date,
  startedDate: Date,
  completionDate: Date,
  // Additional details
  resolution: {
    type: String,
    maxlength: 1000
  },
  materialsUsed: [{
    item: String,
    quantity: Number,
    cost: Number
  }],
  // Feedback from requester
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    date: Date
  },
  // Internal notes for staff
  internalNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Audit trail
  history: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: String
  }]
}, {
  timestamps: true
});

// Indexes for common queries
maintenanceSchema.index({ hostel: 1, status: 1 });
maintenanceSchema.index({ hostel: 1, priority: 1 });
maintenanceSchema.index({ createdAt: -1 });

// Virtual for duration
maintenanceSchema.virtual('duration').get(function() {
  if (this.completionDate && this.createdAt) {
    return this.completionDate - this.createdAt;
  }
  return null;
});

// Pre-save middleware to track history
maintenanceSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.history.push({
      action: 'status_change',
      performedBy: this._updatedBy, // Set this in controller
      details: `Status changed to ${this.status}`
    });
  }
  next();
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);