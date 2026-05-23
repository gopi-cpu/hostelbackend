const mongoose = require('mongoose');
const ngeohash = require("ngeohash");

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
      'boys', 'girls', 'coed', 'working_professionals',
      'single', 'shared', 'studio',
      '1bhk', '2bhk', '3bhk', '4bhk', 'studio_apartment',
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

  // ============ NEW: ROOM LIMITS & MEMBERSHIP TRACKING ============
  roomLimits: {
    maxAllowed: {
      type: Number,
      default: 15, // Basic plan default
      min: 1,
      max: 1000
    },
    currentTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    warningTriggered: {
      type: Boolean,
      default: false
    },
    membershipAtCreation: {
      type: String,
      enum: ['basic', 'premium', 'pro', 'enterprise'],
      default: 'basic'
    },
    overriddenByAdmin: {
      type: Boolean,
      default: false
    },
    overrideReason: String,
    overrideDate: Date
  },

  // Rooms configuration - ADD THIS SECTION (if not already present)
rooms: [{
   type: mongoose.Schema.Types.ObjectId,
   ref: "Room"
}],
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
        type: [Number],
        required: true
      }
    },
    landmarks: [{ type: String }],
    distanceFromCityCenter: Number
  },
  geohash: {
    type: String,
    index: true
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

  // Pricing
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

  // Amenities
  amenities: [{
    type: String,
    enum: [
      'wifi', 'fan', 'light', 'furniture', 'power_backup',
      'ac', 'cooler', 'heater', 'geyser', 'hot_water', 'hotwater',
      'food', 'breakfast', 'lunch', 'dinner', 'kitchen', 'fridge', 'microwave', 'mess',
      'washing_machine', 'dryer', 'ironing', 'laundry_service', 'laundry',
      'tv', 'dth', 'netflix', 'gaming_area', 'common_room',
      'security_guard', 'security', 'cctv', 'biometric', 'digital_lock', 'intercom',
      'gym', 'yoga_area', 'medical_facility', 'first_aid',
      'power_backup', 'elevator', 'parking', 'housekeeping', 'cleaning', 'maintenance',
      'study_table', 'bookshelf', 'work_desk', 'meeting_room', 'study',
      'balcony', 'terrace', 'garden', 'playground',
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

  // Food Details
  food: {
    provided: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['veg', 'non_veg', 'non-veg', 'jain', 'all', 'both']
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

  // Unit Details
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
      enum: ['unfurnished', 'semi_furnished', 'fully_furnished'],
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

  // Images
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
  
  ownerUpiId: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[\w.-]+@[\w]+$/.test(v);
      },
      message: 'Invalid UPI ID format'
    }
  },
  
  managerUpiId: {
    type: String,
    trim: true
  },
  
  ownerPhone: {
    type: String
  },
  
  paymentSettings: {
    acceptDirectUpi: {
      type: Boolean,
      default: true
    },
    requirePaymentProof: {
      type: Boolean,
      default: true
    },
    autoVerifyPayments: {
      type: Boolean,
      default: false
    },
    verificationTimeHours: {
      type: Number,
      default: 24
    }
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

// ============ INDEXES ============
propertySchema.index({ 'location.coordinates': '2dsphere' });
propertySchema.index({ propertyType: 1, status: 1 });
propertySchema.index({ 'pricing.monthlyRent.amount': 1 });
propertySchema.index({ 'rating.average': -1 });
propertySchema.index({ 'availability.availableUnits': 1 });
propertySchema.index({ 'featured.isFeatured': 1, 'featured.featurePriority': -1 });
propertySchema.index({ tags: 1 });
propertySchema.index({ amenities: 1 });
propertySchema.index({ geohash: 1, status: 1 });
propertySchema.index({ 'roomLimits.currentTotal': 1, 'roomLimits.maxAllowed': 1 }); // NEW INDEX

// ============ VIRTUAL FIELDS ============
propertySchema.virtual('fullAddress').get(function() {
  const addr = this.location?.address;
  if (!addr) return '';
  return `${addr.street || ''}, ${addr.area || ''}, ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`;
});

// ============ NEW: VIRTUAL FOR ROOM USAGE PERCENTAGE ============
propertySchema.virtual('roomUsagePercentage').get(function() {
  if (!this.roomLimits.maxAllowed) return 0;
  return (this.roomLimits.currentTotal / this.roomLimits.maxAllowed) * 100;
});

// ============ NEW: VIRTUAL FOR ROOM LIMIT STATUS ============
propertySchema.virtual('roomLimitStatus').get(function() {
  const percentage = this.roomUsagePercentage;
  if (percentage >= 100) return 'exceeded';
  if (percentage >= 90) return 'critical';
  if (percentage >= 75) return 'warning';
  if (percentage >= 50) return 'moderate';
  return 'good';
});

// ============ METHODS ============
// NEW: Method to check if can add rooms
propertySchema.methods.canAddRooms = function(additionalRooms = 1) {
  const newTotal = this.roomLimits.currentTotal + additionalRooms;
  return newTotal <= this.roomLimits.maxAllowed || this.roomLimits.overriddenByAdmin;
};

// NEW: Method to update room count
propertySchema.methods.updateRoomCount = async function () {

   const Room = mongoose.model("Room");

   const totalRooms = await Room.countDocuments({
      hostel: this._id
   });

   this.roomLimits.currentTotal = totalRooms;
   this.roomLimits.lastUpdated = new Date();

   return totalRooms;
};
// NEW: Method to get remaining room capacity
propertySchema.methods.getRemainingRoomCapacity = function() {
  return Math.max(0, this.roomLimits.maxAllowed - this.roomLimits.currentTotal);
};

// ============ PRE-SAVE MIDDLEWARE ============
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-calculate total rooms from rooms array
  if (this.rooms && Array.isArray(this.rooms)) {
    const totalRooms = this.rooms.reduce((sum, room) => sum + (room.count || 0), 0);
    this.roomLimits.currentTotal = totalRooms;
    this.availability.totalUnits = totalRooms;
    this.availability.availableUnits = totalRooms; // Initially all rooms available
  }
  
  // Auto-calculate price category
  const rent = this.pricing?.monthlyRent?.amount || 0;
  if (rent < 8000) this.pricing.priceCategory = 'budget';
  else if (rent < 15000) this.pricing.priceCategory = 'standard';
  else if (rent < 25000) this.pricing.priceCategory = 'premium';
  else this.pricing.priceCategory = 'luxury';

  // Set geohash
  if (
    this.location &&
    this.location.coordinates &&
    Array.isArray(this.location.coordinates.coordinates)
  ) {
    const [lng, lat] = this.location.coordinates.coordinates;
    if (lat && lng) {
      this.geohash = ngeohash.encode(lat, lng, 6);
    }
  }
  
  // Set full address
  if (this.location?.address) {
    this.location.address.fullAddress = this.fullAddress;
  }
  
  // Normalize food.type
  if (this.food?.type === 'both') {
    this.food.type = 'all';
  }
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

// ============ POST INIT MIDDLEWARE ============
propertySchema.post('init', function(doc) {
  // Ensure roomLimits exists even if not in DB (for old documents)
  if (!doc.roomLimits) {
    doc.roomLimits = {
      maxAllowed: 15,
      currentTotal: 0,
      lastUpdated: new Date(),
      membershipAtCreation: 'basic'
    };
  }
});

// ============ STATIC METHODS ============
// NEW: Find properties by room availability
propertySchema.statics.findByRoomAvailability = function(minAvailable = 1) {
  return this.find({
    'rooms.available': { $gte: minAvailable },
    status: 'active'
  });
};

// NEW: Find properties nearing room limit
propertySchema.statics.findNearingRoomLimit = function(threshold = 80) {
  return this.aggregate([
    {
      $addFields: {
        roomLimitPercentage: {
          $multiply: [
            { $divide: ['$roomLimits.currentTotal', '$roomLimits.maxAllowed'] },
            100
          ]
        }
      }
    },
    {
      $match: {
        roomLimitPercentage: { $gte: threshold },
        'roomLimits.currentTotal': { $lt: '$roomLimits.maxAllowed' }
      }
    }
  ]);
};

module.exports = mongoose.model('Property', propertySchema);