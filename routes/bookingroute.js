// routes/bookings.js
const express = require('express');
const router = express.Router();
const {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  checkIn,
  checkOut
} = require('../controllers/bookingcontroller');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.route('/')
  .get(getBookings)
  .post(createBooking);

router.route('/:id')
  .get(getBooking)
  .put(updateBooking)
  .delete(deleteBooking);

router.route('/:id/checkin')
  .put(authorize('admin', 'owner'), checkIn);

router.route('/:id/checkout')
  .put(authorize('admin', 'owner'), checkOut);

module.exports = router;