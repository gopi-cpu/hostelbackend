const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema({
  bedNumber: {
    type: String,
    required: true
  },
  isOccupied: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'reserved'],
    default: 'available'
  },
  currentOccupant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rentAmount: {
    type: Number,
    required: true
  },
  amenities: [String]
});

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true
  },
  floor: {
    type: Number,
    required: true
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true
  },
  roomType: {
    type: String,
    enum: ['single', 'double', 'triple', 'four', 'dormitory'],
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  currentOccupancy: {
    type: Number,
    default: 0
  },
  beds: [bedSchema],
  amenities: [String],
  status: {
    type: String,
    enum: ['available', 'fully_occupied', 'maintenance'],
    default: 'available'
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

// Update currentOccupancy when beds change
roomSchema.pre('save', function(next) {
  this.currentOccupancy = this.beds.filter(bed => bed.isOccupied).length;
  this.updatedAt = Date.now();
  next();
});

// Update room status based on occupancy
roomSchema.pre('save', function(next) {
  if (this.currentOccupancy === this.capacity) {
    this.status = 'fully_occupied';
  } else if (this.beds.some(bed => bed.status === 'maintenance')) {
    this.status = 'maintenance';
  } else {
    this.status = 'available';
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);