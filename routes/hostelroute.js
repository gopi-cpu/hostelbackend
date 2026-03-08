

// const express = require('express');
// const {
//   getHostels,
//   getHostel,
//   createHostel,
//   updateHostel,
//   deleteHostel,
//   deleteHostelImage,
//   getHostelsInRadius
// } = require('../controllers/hostelcontroller');

// const router = express.Router();

// // Include other resource routers
// const reviewRouter = require('../controllers/reviewcontroller');

// // // Re-route into other resource routers
// // router.use('/:hostelId/reviews', reviewRouter);

// router
//   .route('/')
//   .get(getHostels)
//   .post(createHostel);

// router
//   .route('/:id')
//   .get(getHostel)
//   .put(updateHostel)
//   .delete(deleteHostel);

// router
//   .route('/:id/images/:imageId')
//   .delete(deleteHostelImage);

// router
//   .route('/radius/:zipcode/:distance')
//   .get(getHostelsInRadius);

// module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getNearbyProperties,
  searchProperties,
  getFeaturedProperties,
  getPropertiesByArea,
  getNearbyAreas,
  getAreasByCity 
} = require('../controllers/hostelcontroller');

// Public routes
router.get('/', getProperties);
router.get('/areas', getAreasByCity);
router.get('/area/:areaName', getPropertiesByArea); 
router.get('/nearby-areas', getNearbyAreas);  
router.get('/nearby', getNearbyProperties);
router.get('/search', searchProperties);
router.get('/featured', getFeaturedProperties);
router.get('/:id', getProperty);

// Protected routes
router.post('/', protect, createProperty);
router.put('/:id', protect, updateProperty);
router.delete('/:id', protect, deleteProperty);

module.exports = router;