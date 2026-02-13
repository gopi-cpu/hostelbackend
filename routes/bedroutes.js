// routes/beds.js or add to rooms.js
const express = require('express');
const router = express.Router();
const {
  getBeds,
  getBed,
  addBed,
  updateBed,
  deleteBed,
  setBedMaintenance,
  reserveBed,
  cancelReservation,
  swapBeds,
  getAvailableBeds,
  bulkUpdateBeds,
  // ADD THESE:
  assignBed,
  vacateBed,
  getBedHistory
} = require('../controllers/bedController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Existing routes...
router.get('/:roomId/beds', getBeds);
router.get('/:roomId/beds/:bedNumber', getBed);
router.post('/:roomId/beds', protect, authorize('admin', 'owner'), addBed);
router.put('/:roomId/beds/:bedNumber', protect, authorize('admin', 'owner'), updateBed);
router.delete('/:roomId/beds/:bedNumber', protect, authorize('admin', 'owner'), deleteBed);
router.put('/:roomId/beds/:bedNumber/maintenance', protect, authorize('admin', 'owner'), setBedMaintenance);
router.put('/:roomId/beds/:bedNumber/reserve', protect, authorize('admin', 'owner'), reserveBed);
router.put('/:roomId/beds/:bedNumber/cancel-reservation', protect, authorize('admin', 'owner'), cancelReservation);
router.put('/:roomId/beds/swap', protect, authorize('admin', 'owner'), swapBeds);
router.put('/:roomId/beds/bulk-update', protect, authorize('admin', 'owner'), bulkUpdateBeds);

// NEW ROUTES - Add these:
router.put('/:roomId/beds/:bedNumber/assign', protect, authorize('admin', 'owner'), assignBed);
router.put('/:roomId/beds/:bedNumber/vacate', protect, authorize('admin', 'owner'), vacateBed);
router.get('/:roomId/beds/:bedNumber/history', protect, authorize('admin', 'owner'), getBedHistory);

// Hostel-level route
router.get('/hostels/:hostelId/beds/available', getAvailableBeds);

module.exports = router;