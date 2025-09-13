const express = require('express');
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  uploadReviewImages,
  markHelpful,
  reportReview,
  getUserReviews
} = require('../controllers/reviewcontroller');

const { protect } = require('../middleware/authMiddleware');
const { verifyStay, checkDuplicateReview } = require('../middleware/reviewvalidation');

const router = express.Router({ mergeParams: true });

router.route('/:hostelId')
  .get(getReviews)
  .post(protect, verifyStay, checkDuplicateReview, createReview);

router.route('/userreviews/:userId')
  .get(protect, getUserReviews);

router.route('/:id')
  .get(getReview)
  .put(protect, updateReview)
  .delete(protect, deleteReview);

// router.route('/:id/images')
//   .put(protect, uploadReviewImages);

router.route('/:id/helpful')
  .put(protect, markHelpful);

router.route('/:id/report')
  .put(protect, reportReview);

module.exports = router;