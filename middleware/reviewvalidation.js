const Booking = require('../models/bookingschema');
const Review = require('../models/reviewschema');
// Check if user has actually stayed at the hostel
exports.verifyStay = async (req, res, next) => {
  try {
    const { hostel, booking } = req.body;
    const userId = req.user.id;
    console.log("Verifying stay for user:", userId, "hostel:", hostel, "booking:", booking);
    // Check if booking exists and belongs to user
    const existingBooking = await Booking.findOne({
      _id: booking,
      user: userId,
      hostel: hostel,
      status: { $in: ['completed', 'checkedOut'] }
    });

    if (!existingBooking) {
      return res.status(403).json({
        success: false,
        message: 'You can only review hostels where you have completed a stay'
      });
    }

    // Check if check-out date has passed (user has actually stayed)
    const currentDate = new Date();
    if (existingBooking.checkOutDate > currentDate) {
      return res.status(403).json({
        success: false,
        message: 'You can only review after your stay has been completed'
      });
    }

    req.booking = existingBooking;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// Check if user has already reviewed this booking
exports.checkDuplicateReview = async (req, res, next) => {
  try {
    const { booking } = req.body;
    const existingReview = await Review.findOne({ booking });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this booking'
      });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};