const express = require('express');
const router = express.Router();
const {
  getStates,
  getCities,
  getAreas,
  getAreasByState,
  searchAreas,
  getAreaDetails,
  getNearbyAreas,
  getPopularCities,
  createState,
  createCity,
  createArea
} = require('../controllers/locationController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/states', getStates);
router.get('/cities', getCities);
router.get('/areas', getAreas);
// router.get('/areas-by-state/:stateId', getAreasByState);
router.get('/search-areas', searchAreas);
// router.get('/areas/:areaId', getAreaDetails);
router.get('/nearby-areas', getNearbyAreas);
router.get('/popular-cities', getPopularCities);

// Admin only routes
router.post('/states', protect, authorize('admin'), createState);
router.post('/cities', protect, authorize('admin'), createCity);
router.post('/areas', protect, authorize('admin'), createArea);

module.exports = router;