const mongoose = require('mongoose');

const areaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add an area name'],
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  city: {
    type: mongoose.Schema.ObjectId,
    ref: 'City',
    required: true
  },
  cityName: {
    type: String,
    required: true
  },
  state: {
    type: mongoose.Schema.ObjectId,
    ref: 'State',
    required: true
  },
  stateName: {
    type: String,
    required: true
  },
  // CRITICAL: Must be GeoJSON format
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  // Keep old coordinates field for backward compatibility or remove
  // coordinates: {
  //   type: [Number],
  //   index: '2dsphere'  // OLD WAY - DEPRECATED
  // },
  pincode: String,
  landmarks: [String],
  properties: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Property'
  }],
  propertyCount: {
    type: Number,
    default: 0
  },
  areaType: {
    type: String,
    enum: ['residential', 'commercial', 'mixed', 'student-hub', 'corporate'],
    default: 'mixed'
  },
  rentRange: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'INR' }
  },
  commonAmenities: [String],
  transport: {
    metro: Boolean,
    bus: Boolean,
    railway: Boolean,
    airportDistance: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  searchCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// CRITICAL: Create 2dsphere index on location.coordinates
areaSchema.index({ location: '2dsphere' });
areaSchema.index({ city: 1, isActive: 1 });
areaSchema.index({ name: 'text', displayName: 'text' });
areaSchema.index({ state: 1, city: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Area', areaSchema);