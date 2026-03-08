const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Please add a property name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  // Property Type (Critical for your frontend tabs)
  propertyType: {
    type: String,
    required: true,
    enum: ['hostel', 'room', 'flat', 'house', 'pg', 'coliving'],
    default: 'hostel'
  },
  
  // Sub-type - UPDATED to match frontend
  subType: {
    type: String,
    enum: [
      // Hostel/PG types - MATCHES FRONTEND
      'boys', 'girls', 'coed', 'working_professionals',
      // Room types  
      'single', 'shared', 'studio',
      // Flat types
      '1bhk', '2bhk', '3bhk', '4bhk', 'studio_apartment',
      // House types
      'independent', 'villa', 'bungalow', 'row_house'
    ]
  },

  // Owner reference
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Location (Enhanced for "Near Me" feature)
  location: {
    address: {
      street: { type: String, required: true },
      area: { type: String, required: true },
      city: { type: String, required: true, index: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true, index: true },
      country: { type: String, default: 'India' },
      fullAddress: String
    },
    coordinates: {
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
    landmarks: [{ type: String }],
    distanceFromCityCenter: Number
  },

  // Contact Info
  contact: {
    phone: { type: String, required: true },
    whatsapp: String,
    email: { type: String, required: true },
    emergencyContact: String,
    preferredContactMethod: {
      type: String,
      enum: ['phone', 'whatsapp', 'email'],
      default: 'phone'
    }
  },

  // PricingA
  pricing: {
    monthlyRent: {
      amount: { type: Number, required: true, index: true },
      currency: { type: String, default: 'INR' },
      negotiable: { type: Boolean, default: false }
    },
    securityDeposit: {
      amount: { type: Number, required: true },
      refundable: { type: Boolean, default: true },
      refundPolicy: String
    },
    maintenanceCharges: {
      amount: Number,
      frequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly'
      }
    },
    foodCharges: {
      amount: Number,
      included: { type: Boolean, default: false },
      mandatory: { type: Boolean, default: false }
    },
    electricityCharges: {
      type: String,
      enum: ['included', 'separate', 'fixed'],
      default: 'separate'
    },
    otherCharges: [{
      name: String,
      amount: Number,
      frequency: String
    }],
    priceCategory: {
      type: String,
      enum: ['budget', 'standard', 'premium', 'luxury'],
      index: true
    }
  },

  // Availability & Capacity
  availability: {
    totalUnits: { type: Number, required: true },
    availableUnits: { type: Number, required: true, index: true },
    availableFrom: Date,
    minimumStay: {
      duration: Number,
      unit: {
        type: String,
        enum: ['days', 'months', 'years'],
        default: 'months'
      }
    },
    maximumStay: {
      duration: Number,
      unit: {
        type: String,
        enum: ['months', 'years'],
        default: 'years'
      }
    },
    noticePeriod: {
      duration: Number,
      unit: {
        type: String,
        enum: ['days', 'months'],
        default: 'months'
      }
    }
  },

  // Amenities - UPDATED to match frontend FACILITIES_LIST
  amenities: [{
    type: String,
    enum: [
      // Frontend: 'wifi', 'ac', 'laundry', 'kitchen', 'parking', 'gym', 'security', 'cleaning', 
      // 'hotwater', 'tv', 'study', 'mess', 'power_backup', 'elevator', 'cctv'
      
      // Basic
      'wifi', 'fan', 'light', 'furniture', 'power_backup',
      // Comfort
      'ac', 'cooler', 'heater', 'geyser', 'hot_water', 'hotwater', // hotwater alias
      // Food
      'food', 'breakfast', 'lunch', 'dinner', 'kitchen', 'fridge', 'microwave', 'mess',
      // Laundry
      'washing_machine', 'dryer', 'ironing', 'laundry_service', 'laundry', // laundry alias
      // Entertainment
      'tv', 'dth', 'netflix', 'gaming_area', 'common_room',
      // Security
      'security_guard', 'security', 'cctv', 'biometric', 'digital_lock', 'intercom', // security alias
      // Health
      'gym', 'yoga_area', 'medical_facility', 'first_aid',
      // Convenience
      'power_backup', 'elevator', 'parking', 'housekeeping', 'cleaning', 'maintenance', // cleaning alias
      // Study/Work
      'study_table', 'bookshelf', 'work_desk', 'meeting_room', 'study', // study alias
      // Outdoor
      'balcony', 'terrace', 'garden', 'playground',
      // Social
      'cafeteria', 'mess', 'dining_hall'
    ]
  }],

  // Rules & Policies
  rules: {
    general: [String],
    guestPolicy: {
      allowed: { type: Boolean, default: true },
      restrictions: String
    },
    petPolicy: {
      allowed: { type: Boolean, default: false },
      restrictions: String
    },
    smokingPolicy: {
      allowed: { type: Boolean, default: false },
      areas: [String]
    },
    alcoholPolicy: {
      allowed: { type: Boolean, default: false }
    },
    curfewTime: String,
    entryExitTimings: String
  },

  // Food Details - UPDATED to match frontend
  food: {
    provided: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['veg', 'non_veg', 'non-veg', 'jain', 'all', 'both'] // Added 'non-veg' and 'both' aliases
    },
    mealsIncluded: [{
      type: String,
      enum: ['breakfast', 'lunch', 'evening_snacks', 'dinner']
    }],
    cuisine: [String],
    specialDiets: [String],
    messCharges: Number,
    sampleMenu: String
  },

  // Room/Unit Details
  unitDetails: {
    roomSize: {
      value: Number,
      unit: {
        type: String,
        enum: ['sqft', 'sqm'],
        default: 'sqft'
      }
    },
    furnished: {
      type: String,
      enum: ['unfurnished', 'semi_furnished', 'fully_furnished'], // Added hyphenated version
      default: 'fully_furnished'
    },
    bathroomType: {
      type: String,
      enum: ['attached', 'common', 'shared'],
      default: 'attached'
    },
    balcony: Boolean,
    windowView: String,
    floorNumber: Number,
    totalFloors: Number
  },

  // Images with categories - UPDATED to match frontend
  images: [{
    url: { type: String, required: true },
    thumbnail: String,
    category: {
      type: String,
      enum: ['exterior', 'interior', 'room', 'bathroom', 'kitchen', 'common_area', 'lobby', 'food', 'amenities', 'view', 'other'],
      default: 'interior'
    },
    caption: String,
    isPrimary: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Rating & Reviews
  rating: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
      index: true
    },
    count: {
      type: Number,
      default: 0
    },
    breakdown: {
      cleanliness: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      location: { type: Number, default: 0 },
      safety: { type: Number, default: 0 },
      amenities: { type: Number, default: 0 },
      valueForMoney: { type: Number, default: 0 },
      management: { type: Number, default: 0 }
    }
  },

  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],

  featured: {
    isFeatured: { type: Boolean, default: false, index: true },
    featurePriority: { type: Number, default: 0 },
    featuredUntil: Date,
    featureReason: String
  },

  verification: {
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    documents: [{
      type: {
        type: String,
        enum: ['identity', 'address_proof', 'ownership', 'license', 'fire_safety']
      },
      url: String,
      verified: Boolean,
      uploadedAt: Date
    }]
  },

  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'inactive', 'suspended', 'rejected'],
    default: 'pending',
    index: true
  },

  bookingSettings: {
    instantBooking: { type: Boolean, default: false },
    advanceBookingDays: { type: Number, default: 7 },
    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderate', 'strict'],
      default: 'moderate'
    },
    refundPolicy: String
  },

  tags: [String],
  keywords: [String],
  nearbyPlaces: [{
    name: String,
    type: {
      type: String,
      enum: ['college', 'office', 'metro', 'bus_stop', 'hospital', 'mall', 'restaurant', 'market']
    },
    distance: Number,
    duration: Number
  }],

  stats: {
    totalViews: { type: Number, default: 0 },
    totalInquiries: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    lastViewedAt: Date,
    popularityScore: { type: Number, default: 0 }
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
propertySchema.index({ 'location.coordinates': '2dsphere' });
propertySchema.index({ propertyType: 1, status: 1 });
propertySchema.index({ 'pricing.monthlyRent.amount': 1 });
propertySchema.index({ 'rating.average': -1 });
propertySchema.index({ 'availability.availableUnits': 1 });
propertySchema.index({ 'featured.isFeatured': 1, 'featured.featurePriority': -1 });
propertySchema.index({ tags: 1 });
propertySchema.index({ amenities: 1 });

// Virtual for full address
propertySchema.virtual('fullAddress').get(function() {
  const addr = this.location?.address;
  if (!addr) return '';
  return `${addr.street || ''}, ${addr.area || ''}, ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`;
});

// Pre-save middleware
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-calculate price category
  const rent = this.pricing?.monthlyRent?.amount || 0;
  if (rent < 8000) this.pricing.priceCategory = 'budget';
  else if (rent < 15000) this.pricing.priceCategory = 'standard';
  else if (rent < 25000) this.pricing.priceCategory = 'premium';
  else this.pricing.priceCategory = 'luxury';

    if (this.location?.coordinates?.coordinates) {
    const lng = this.location.coordinates.coordinates[0];
    const lat = this.location.coordinates.coordinates[1];
    this.geohash = ngeohash.encode(lat, lng, 6);
  }

  // Set full address
  if (this.location?.address) {
    this.location.address.fullAddress = this.fullAddress;
  }
  
  // Normalize food.type: convert 'both' to 'all'
  if (this.food?.type === 'both') {
    this.food.type = 'all';
  }
  // Normalize food.type: convert 'non-veg' to 'non_veg'
  if (this.food?.type === 'non-veg') {
    this.food.type = 'non_veg';
  }
  
  // Normalize amenities aliases
  if (this.amenities && Array.isArray(this.amenities)) {
    const aliases = {
      'hotwater': 'hot_water',
      'laundry': 'laundry_service',
      'security': 'security_guard',
      'cleaning': 'housekeeping',
      'study': 'study_table'
    };
    this.amenities = this.amenities.map(amenity => aliases[amenity] || amenity);
  }
  
  next();
});

module.exports = mongoose.model('Property', propertySchema);23