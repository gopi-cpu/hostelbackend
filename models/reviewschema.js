const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  hostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: [true, 'Hostel is required']
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking reference is required'],
    validate: {
      validator: async function(bookingId) {
        const Booking = mongoose.model('Booking');
        const booking = await Booking.findById(bookingId);
        return booking && booking.user.toString() === this.user.toString();
      },
      message: 'Booking must belong to the user'
    }
  },
  rating: {
    overall: { 
      type: Number, 
      required: [true, 'Overall rating is required'], 
      min: [1, 'Rating must be at least 1'], 
      max: [5, 'Rating cannot exceed 5'] 
    },
    cleanliness: { 
      type: Number, 
      min: [1, 'Rating must be at least 1'], 
      max: [5, 'Rating cannot exceed 5'] 
    },
    food: { 
      type: Number, 
      min: [1, 'Rating must be at least 1'], 
      max: [5, 'Rating cannot exceed 5'] 
    },
    safety: { 
      type: Number, 
      min: [1, 'Rating must be at least 1'], 
      max: [5, 'Rating cannot exceed 5'] 
    },
    amenities: { 
      type: Number, 
      min: [1, 'Rating must be at least 1'], 
      max: [5, 'Rating cannot exceed 5'] 
    }
  },
  title: {
    type: String,
    required: [true, 'Review title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  images: [String],
  isVerified: {
    type: Boolean,
    default: false
  },
  helpful: {
    count: { type: Number, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  reported: {
    count: { type: Number, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
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

// Ensure one review per booking
reviewSchema.index({ booking: 1 }, { unique: true });

// Compound index for better query performance
reviewSchema.index({ hostel: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

// Pre-save middleware to verify the user actually stayed
reviewSchema.pre('save', async function(next) {
  try {
    const Booking = mongoose.model('Booking');
    
    // Check if the booking exists and user actually stayed
    const booking = await Booking.findOne({
      _id: this.booking,
      user: this.user,
      hostel: this.hostel,
      status: { $in: ['completed', 'checkedOut'] },
      checkOutDate: { $lt: new Date() } // Check-out date has passed
    });

    if (!booking) {
      throw new Error('You can only review hostels where you have completed a stay');
    }

    // Auto-verify the review since we've validated the stay
    this.isVerified = true;
    next();
  } catch (error) {
    next(error);
  }
});

// Update hostel rating when a review is saved or updated
reviewSchema.post('save', async function() {
  await updateHostelRating(this.hostel);
});

reviewSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    await updateHostelRating(doc.hostel);
  }
});

reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await updateHostelRating(doc.hostel);
  }
});

// Helper function to update hostel rating
async function updateHostelRating(hostelId) {
  const Review = mongoose.model('Review');
  
  const stats = await Review.aggregate([
    { $match: { hostel: hostelId } },
    {
      $group: {
        _id: '$hostel',
        averageRating: { $avg: '$rating.overall' },
        numberOfReviews: { $sum: 1 },
        cleanliness: { $avg: '$rating.cleanliness' },
        food: { $avg: '$rating.food' },
        safety: { $avg: '$rating.safety' },
        amenities: { $avg: '$rating.amenities' }
      }
    }
  ]);
  
  const Hostel = mongoose.model('Hostel');
  
  if (stats.length > 0) {
    await Hostel.findByIdAndUpdate(hostelId, {
      'rating.average': stats[0].averageRating,
      'rating.count': stats[0].numberOfReviews,
      'rating.breakdown': {
        cleanliness: stats[0].cleanliness,
        food: stats[0].food,
        safety: stats[0].safety,
        amenities: stats[0].amenities
      }
    });
  } else {
    // Reset ratings if no reviews exist
    await Hostel.findByIdAndUpdate(hostelId, {
      'rating.average': 0,
      'rating.count': 0,
      'rating.breakdown': {
        cleanliness: 0,
        food: 0,
        safety: 0,
        amenities: 0
      }
    });
  }
}

module.exports = mongoose.model('Review', reviewSchema);