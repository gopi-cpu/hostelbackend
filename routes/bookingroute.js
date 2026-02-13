// routes/bookings.js
const express = require('express');
const router = express.Router();
const {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  confirmBooking,
  checkIn,
  checkOut,
  cancelBooking,
  getBookingStats
} = require('../controllers/bookingController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Apply protection to all routes
router.use(protect);

// Statistics route (must be before /:id routes)
router.get('/stats/overview', authorize('admin', 'owner'), getBookingStats);

// Main routes
router.route('/')
  .get(getBookings)
  .post(createBooking);

// Single booking routes
router.route('/:id')
  .get(getBooking)
  .put(updateBooking)
  .delete(authorize('admin'), deleteBooking); // Only admin can hard delete

// Booking lifecycle routes
router.put('/:id/confirm', authorize('admin', 'owner'), confirmBooking);
router.put('/:id/cancel', cancelBooking); // Any authenticated user can cancel their own
router.put('/:id/checkin', authorize('admin', 'owner'), checkIn);
router.put('/:id/checkout', authorize('admin', 'owner'), checkOut);

module.exports = router;