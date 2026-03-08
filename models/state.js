const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a state name'],
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  // Optional: Store center coordinates for map centering
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Metadata
  totalCities: {
    type: Number,
    default: 0
  },
  totalProperties: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

stateSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('State', stateSchema);