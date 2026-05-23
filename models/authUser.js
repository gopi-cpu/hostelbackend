// models/User.js (or authUser.js - be consistent!)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,  // Email is globally unique for login
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['student', 'admin', 'owner', 'staff'],
    default: 'student'
  },
    membership: {
    type: {
      type: String,
      enum: ['basic', 'premium', 'pro', 'enterprise'],
      default: 'basic'
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    features: {
      maxRoomsPerProperty: {
        type: Number,
        default: 15
      },
      maxProperties: {
        type: Number,
        default: 1
      },
      canAddPhotos: {
        type: Number,
        default: 10
      },
      prioritySupport: {
        type: Boolean,
        default: false
      }
    }
  },
    ownedProperties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Track all hostels this user is associated with (as student)
  studentProfiles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  // Track bookings made by this user
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  }],
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.methods.getMembershipLimits = function() {
  const limits = {
    basic: {
      maxRoomsPerProperty: 15,
      maxProperties: 1,
      maxPhotosPerProperty: 10,
      prioritySupport: false,
      featuredListing: false
    },
    premium: {
      maxRoomsPerProperty: 25,
      maxProperties: 3,
      maxPhotosPerProperty: 20,
      prioritySupport: true,
      featuredListing: false
    },
    pro: {
      maxRoomsPerProperty: 30,
      maxProperties: 5,
      maxPhotosPerProperty: 30,
      prioritySupport: true,
      featuredListing: true
    },
    enterprise: {
      maxRoomsPerProperty: 100,
      maxProperties: 999,
      maxPhotosPerProperty: 50,
      prioritySupport: true,
      featuredListing: true
    }
  };
  
  return limits[this.membership.type] || limits.basic;
};


// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);