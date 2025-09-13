// const express = require('express');
// const {
//   getHostels,
//   getHostel,
//   createHostel,
//   updateHostel,
//   deleteHostel,
//   uploadHostelImages,
//   deleteHostelImage,
//   getHostelsInRadius
// } = require('../controllers/hostelController');

// const { protect, checkHostelOwnership } = require('../middleware/authMiddleware');

// // Include other resource routers


// const router = express.Router();

// router.route('/radius/:zipcode/:distance').get(getHostelsInRadius);

// router
//   .route('/')
//   .get(getHostels)
//   .post(protect, createHostel);

// router
//   .route('/:id')
//   .get(getHostel)
//   .put(protect, checkHostelOwnership, updateHostel)
//   .delete(protect, checkHostelOwnership, deleteHostel);

// // router.route('/:id/images').put(protect, checkHostelOwnership, uploadHostelImages);

// router.route('/:id/images/:imageId').delete(protect, checkHostelOwnership, deleteHostelImage);

// module.exports = router;

const express = require('express');
const {
  getHostels,
  getHostel,
  createHostel,
  updateHostel,
  deleteHostel,
  deleteHostelImage,
  getHostelsInRadius
} = require('../controllers/hostelcontroller');

const router = express.Router();

// Include other resource routers
const reviewRouter = require('../controllers/reviewcontroller');

// // Re-route into other resource routers
// router.use('/:hostelId/reviews', reviewRouter);

router
  .route('/')
  .get(getHostels)
  .post(createHostel);

router
  .route('/:id')
  .get(getHostel)
  .put(updateHostel)
  .delete(deleteHostel);

router
  .route('/:id/images/:imageId')
  .delete(deleteHostelImage);

router
  .route('/radius/:zipcode/:distance')
  .get(getHostelsInRadius);

module.exports = router;