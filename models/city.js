const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a city name'],
    trim: true
  },
  // Reference to State
  state: {
    type: mongoose.Schema.ObjectId,
    ref: 'State',
    required: true
  },
  stateName: {
    type: String,
    required: true
  },
  // For search/slugs
  slug: {
    type: String,
    lowercase: true
  },
  // Center coordinates of city
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
  // Popular areas within this city (for quick selection)
  popularAreas: [{
    name: String,
    coordinates: [Number], // [lng, lat]
    propertyCount: {
      type: Number,
      default: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  // Metadata
  totalAreas: {
    type: Number,
    default: 0
  },
  totalProperties: {
    type: Number,
    default: 0
  },
  // Display order
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

citySchema.index({ location: '2dsphere' });
citySchema.index({ name: 1, state: 1 }, { unique: true });
citySchema.index({ state: 1, isActive: 1 });
citySchema.index({ isPopular: 1 });

module.exports = mongoose.model('City', citySchema);