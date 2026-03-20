// models/Tenants.js (or Student.js - rename for consistency)
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
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
    // Not unique globally - user can be tenant in multiple hostels
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
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true
  },
  // Composite unique index: One user can only be tenant once per hostel
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,  // Now required - every tenant must have a user account
    index: true
  },
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
  hasLoginAccess: {
    type: Boolean,
    default: true  // Always true now since we create user accounts
  },
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


// Compound index: One user can only be tenant once per hostel
tenantSchema.index({ userId: 1, hostelId: 1 }, { unique: true });
// Index for finding tenants by user
tenantSchema.index({ userId: 1, status: 1 });
// Index for phone lookups
tenantSchema.index({ phone: 1 });

const Tenants = mongoose.models.Tenants || mongoose.model("Tenants", tenantSchema);


module.exports = Tenants;