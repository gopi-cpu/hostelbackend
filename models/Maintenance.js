// models/Maintenance.js (Updated to match React Native frontend)
const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
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
  studentProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  },
  
  // UPDATED: Match React Native CATEGORIES
  category: {
    type: String,
    enum: ['plumbing', 'electrical', 'ac', 'furniture', 'cleaning', 'pest', 'internet', 'other'],
    required: true
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // UPDATED: Match React Native PRIORITIES (capitalized)
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  
  images: [{
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // UPDATED: Match React Native status values
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'closed'],
    default: 'pending',
    index: true
  },
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  estimatedCost: {
    type: Number,
    min: 0
  },
  actualCost: {
    type: Number,
    min: 0
  },
  
  scheduledDate: Date,
  startedDate: Date,
  completionDate: Date,
  
  resolution: {
    type: String,
    maxlength: 1000
  },
  
  materialsUsed: [{
    item: String,
    quantity: Number,
    cost: Number
  }],
  
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    date: Date
  },
  
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

// Indexes
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

// Pre-save middleware
maintenanceSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.history.push({
      action: 'status_change',
      performedBy: this._updatedBy,
      details: `Status changed to ${this.status}`
    });
  }
  next();
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);