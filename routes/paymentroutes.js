// routes/payments.js
const express = require('express');
const router = express.Router();
const {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getUserPayments,
  getHostelPayments,
  generateMonthlyBills,
  processPaymentWebhook,
  getPaymentStats
} = require('../controllers/paymentcontroller');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.route('/')
  .get(getPayments)
  .post(createPayment);

router.route('/stats')
  .get(authorize('admin'), getPaymentStats);

router.route('/generate-bills')
  .post(authorize('admin'), generateMonthlyBills);

router.route('/webhook')
  .post(processPaymentWebhook);

router.route('/user/:userId')
  .get(getUserPayments);

router.route('/hostel/:hostelId')
  .get(authorize('admin', 'manager'), getHostelPayments);

router.route('/:id')
  .get(getPayment)
  .put(authorize('admin'), updatePayment)
  .delete(authorize('admin'), deletePayment);

module.exports = router;