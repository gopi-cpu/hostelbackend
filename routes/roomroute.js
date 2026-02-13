const express = require('express');
const router = express.Router();

// Import controller functions
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  assignBed,
  vacateBed
} = require('../controllers/roomcontroller');

// Import authentication middleware
const { protect, authorize } = require('../middleware/authMiddleware');

// Define routes
router
  .route('/')
  .post(protect, authorize('owner', 'admin'), createRoom);

router
  .route('/:id')
  .get(getRoom)
  .put(protect, authorize('owner', 'admin'), updateRoom)
  .delete(protect, authorize('owner', 'admin'), deleteRoom);

router
  .route('/:hostelId/rooms')
  .get(getRooms);

router
  .route('/:id/beds/:bedNumber/assign')
  .put(protect, authorize('owner', 'admin'), assignBed);

router
  .route('/:id/beds/:bedNumber/vacate')
  .put(protect, authorize('owner', 'admin'), vacateBed);

  

module.exports = router;