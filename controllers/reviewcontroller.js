const Review = require('../models/reviewschema');
const Booking = require('../models/bookingschema');
const Hostel = require('../models/hostelschema');

// @desc    Get all reviews for a hostel
// @route   GET /api/v1/hostels/:hostelId/reviews
// @access  Public
exports.getReviews = async (req, res, next) => {
  try {
    const { hostelId } = req.params;

    const reviews = await Review.find({ hostel: hostelId })
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single review
// @route   GET /api/v1/reviews/:id
// @access  Public
exports.getReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name profileImage')
      .populate('hostel', 'name');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create review
// @route   POST /api/v1/hostels/:hostelId/reviews
// @access  Private
exports.createReview = async (req, res, next) => {
  try {
    const { hostelId } = req.params;
    req.body.hostel = hostelId;
    req.body.user = req.user.id;
    
   
    const review = await Review.create(req.body);

    // Populate the review with user info
    await review.populate('user', 'name profileImage');

    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    } else if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this booking'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }
};

// @desc    Update review
// @route   PUT /api/v1/reviews/:id
// @access  Private
exports.updateReview = async (req, res, next) => {
  try {
    let review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    // Prevent updating booking reference
    if (req.body.booking) {
      delete req.body.booking;
    }

    // Prevent updating hostel reference
    if (req.body.hostel) {
      delete req.body.hostel;
    }

    review = await Review.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('user', 'name profileImage');

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }
};

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review or is admin
    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    // Delete associated images from Cloudinary
    if (review.images && review.images.length > 0) {
      for (const imageUrl of review.images) {
        const publicId = imageUrl.split('/').pop().split('.')[0];
        await deleteImage(`reviews/${publicId}`);
      }
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Upload review images
// @route   PUT /api/v1/reviews/:id/images
// @access  Private
// exports.uploadReviewImages = async (req, res, next) => {
//   try {
//     const review = await Review.findById(req.params.id);

//     if (!review) {
//       return res.status(404).json({
//         success: false,
//         message: 'Review not found'
//       });
//     }

//     // Check if user owns the review
//     if (review.user.toString() !== req.user.id) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to update this review'
//       });
//     }

//     if (!req.files) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please upload an image'
//       });
//     }

//     const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
//     const uploadedImages = [];

//     // Upload images
//     for (const file of imageFiles) {
//       const result = await uploadImage(file.tempFilePath, 'reviews');
//       uploadedImages.push(result.secure_url);
//     }

//     // Add new images to review
//     review.images = [...review.images, ...uploadedImages];
//     await review.save();

//     res.status(200).json({
//       success: true,
//       data: review.images
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server Error'
//     });
//   }
// };

// @desc    Mark review as helpful
// @route   PUT /api/v1/reviews/:id/helpful
// @access  Private
exports.markHelpful = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const userId = req.user.id;

    // Check if user already marked this review as helpful
    const alreadyHelpful = review.helpful.users.includes(userId);

    if (alreadyHelpful) {
      // Remove helpful mark
      review.helpful.users.pull(userId);
      review.helpful.count = Math.max(0, review.helpful.count - 1);
    } else {
      // Add helpful mark
      review.helpful.users.push(userId);
      review.helpful.count += 1;

      // Remove from reported if exists
      if (review.reported.users.includes(userId)) {
        review.reported.users.pull(userId);
        review.reported.count = Math.max(0, review.reported.count - 1);
      }
    }

    await review.save();

    res.status(200).json({
      success: true,
      data: {
        helpful: review.helpful,
        reported: review.reported
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Report review
// @route   PUT /api/v1/reviews/:id/report
// @access  Private
exports.reportReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    const userId = req.user.id;

    // Check if user already reported this review
    const alreadyReported = review.reported.users.includes(userId);

    if (alreadyReported) {
      // Remove report
      review.reported.users.pull(userId);
      review.reported.count = Math.max(0, review.reported.count - 1);
    } else {
      // Add report
      review.reported.users.push(userId);
      review.reported.count += 1;

      // Remove from helpful if exists
      if (review.helpful.users.includes(userId)) {
        review.helpful.users.pull(userId);
        review.helpful.count = Math.max(0, review.helpful.count - 1);
      }
    }

    await review.save();

    res.status(200).json({
      success: true,
      data: {
        helpful: review.helpful,
        reported: review.reported
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get user's reviews
// @route   GET /api/v1/users/reviews
// @access  Private
exports.getUserReviews = async (req, res, next) => {
  try {
    console.log("user",req.user)
    const reviews = await Review.find({ user: req.params.userId })
      .populate('hostel', 'name address')
      .sort({ createdAt: -1 });
      console.log('reviews',reviews)
    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};