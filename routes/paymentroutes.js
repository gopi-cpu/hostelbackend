const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // For image upload
const {
  getPayments,
  getPayment,
  getUpiPaymentDetails,
  submitPaymentProof,
  verifyPayment,
  getPendingVerifications,
  checkPaymentStatus,
  generateMonthlyBills,
  getUserPayments,
  getHostelPayments,
  getPaymentStats
} = require('../controllers/paymentcontroller');

// All routes are protected
router.use(protect);

// UPI Payment Routes
router.get('/upi-details/:bookingId', getUpiPaymentDetails);
router.post('/submit-proof/:paymentId', upload.single('paymentProof'), submitPaymentProof);
router.get('/status/:paymentId', checkPaymentStatus);
router.get('/pending-verifications', authorize('admin', 'owner'), getPendingVerifications);
router.put('/verify/:paymentId', authorize('admin', 'owner'), verifyPayment);

// Standard Routes
router.get('/', getPayments);
// router.get('/stats', authorize('admin'), getPaymentStats);
// router.get('/user/:userId', getUserPayments);
// router.get('/hostel/:hostelId', authorize('admin', 'owner', 'manager'), getHostelPayments);
router.get('/:id', getPayment);
router.post('/generate-bills', authorize('admin'), generateMonthlyBills);

module.exports = router;