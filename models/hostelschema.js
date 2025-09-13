const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a hostel name'],
    trim: true,
    maxlength: [100, 'Hostel name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contact: {
    phone: { type: String, required: true },
    email: { type: String, required: true },
    emergencyContact: String
  },
  amenities: [{
    type: String,
    enum: [
      'wifi', 'ac', 'food', 'laundry', 'cleaning', 'powerBackup', 
      'hotWater', 'parking', 'security', 'cctv', 'gym', 'commonArea'
    ]
  }],
  rules: [String],
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false }
  }],
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    breakdown: {
      cleanliness: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      safety: { type: Number, default: 0 },
      amenities: { type: Number, default: 0 }
    }
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  billingSettings: {
    rentDueDate: { type: Number, default: 1, min: 1, max: 28 },
    lateFeePercentage: { type: Number, default: 5, min: 0, max: 25 },
    securityDeposit: { type: Number, default: 0 },
    paymentMethods: [{
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'card']
    }]
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

hostelSchema.virtual('reviews', {
  ref: 'Review',             // The model to use
  localField: '_id',         // Find reviews where `hostel` = hostel._id
  foreignField: 'hostel',    // In Review schema you must have `hostel: { type: ObjectId, ref: 'Hostel' }`
});

// Update updatedAt field before saving
hostelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});



module.exports = mongoose.model('Hostel', hostelSchema);


// // models/Hostel.js
// const mongoose = require('mongoose');

// const roomSchema = new mongoose.Schema({
//   roomNumber: {
//     type: String,
//     required: true
//   },
//   floor: {
//     type: Number,
//     required: true
//   },
//   roomType: {
//     type: String,
//     enum: ['single', 'double', 'triple', 'four', 'dormitory'],
//     required: true
//   },
//   capacity: {
//     type: Number,
//     required: true
//   },
//   currentOccupancy: {
//     type: Number,
//     default: 0
//   },
//   beds: [{
//     bedNumber: {
//       type: String,
//       required: true
//     },
//     isOccupied: {
//       type: Boolean,
//       default: false
//     },
//     currentOccupant: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     rentAmount: {
//       type: Number,
//       required: true
//     },
//     amenities: [String],
//     status: {
//       type: String,
//       enum: ['available', 'occupied', 'maintenance', 'reserved'],
//       default: 'available'
//     }
//   }],
//   amenities: [String],
//   status: {
//     type: String,
//     enum: ['available', 'fully_occupied', 'maintenance'],
//     default: 'available'
//   }
// });

// const hostelSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     required: true
//   },
//   owner: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   // ... other existing fields
//   rooms: [roomSchema],
//   billingSettings: {
//     rentDueDate: {
//       type: Number,
//       default: 1,
//       min: 1,
//       max: 28
//     },
//     lateFeePercentage: {
//       type: Number,
//       default: 5,
//       min: 0,
//       max: 25
//     },
//     securityDeposit: {
//       type: Number,
//       default: 0
//     },
//     paymentMethods: [{
//       type: String,
//       enum: ['cash', 'bank_transfer', 'upi', 'card']
//     }]
//   },
//   // ... other existing fields
// });

// module.exports = mongoose.model('Hostel', hostelSchema);



// // models/Hostel.js
// const mongoose = require('mongoose');

// const hostelSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     required: true
//   },
//   owner: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   address: {
//     street: { type: String, required: true },
//     city: { type: String, required: true },
//     state: { type: String, required: true },
//     pincode: { type: String, required: true },
//     country: { type: String, default: 'India' },
//     coordinates: {
//       latitude: Number,
//       longitude: Number
//     }
//   },
//   contact: {
//     phone: { type: String, required: true },
//     email: { type: String, required: true },
//     emergencyContact: String
//   },
//   amenities: [{
//     type: String,
//     enum: [
//       'wifi', 'ac', 'food', 'laundry', 'cleaning', 'powerBackup', 
//       'hotWater', 'parking', 'security', 'cctv', 'gym', 'commonArea'
//     ]
//   }],
//   roomTypes: [{
//     sharingType: {
//       type: String,
//       enum: ['single', 'double', 'triple', 'four', 'dormitory'],
//       required: true
//     },
//     price: {
//       type: Number,
//       required: true
//     },
//     available: {
//       type: Number,
//       default: 0
//     },
//     facilities: [String]
//   }],
//   images: [{
//     url: String,
//     caption: String,
//     isPrimary: { type: Boolean, default: false }
//   }],
//   rules: [String],
//   rating: {
//     average: { type: Number, default: 0 },
//     count: { type: Number, default: 0 }
//   },
//   isApproved: {
//     type: Boolean,
//     default: false
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// hostelSchema.pre('save', function(next) {
//   this.updatedAt = Date.now();
//   next();
// });

// module.exports = mongoose.model('Hostel', hostelSchema);