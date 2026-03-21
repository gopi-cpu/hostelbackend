const Payment = require('../models/paymentSchema');
const Booking = require('../models/bookingschema');
const Hostel = require('../models/hostelschema');
const User = require('../models/authUser');
const { v4: uuidv4 } = require('uuid');

// Helper function to generate UPI URL
const generateUpiUrl = (upiId, name, amount, transactionNote) => {
  const encodedName = encodeURIComponent(name);
  const encodedNote = encodeURIComponent(transactionNote);

  return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}`;
};

// Helper function to generate deep links for specific apps
const generateAppDeepLinks = (upiId, name, amount, note,transactionRef) => {
  const baseUpiUrl = generateUpiUrl(upiId, name, amount, note,transactionRef);

  return {
    generic: baseUpiUrl,
    phonepe: baseUpiUrl,
    googlePay: baseUpiUrl,
    paytm: baseUpiUrl,
    amazonPay: baseUpiUrl
  };
};

// @desc    Get UPI payment details for a booking
// @route   GET /api/v1/payments/upi-details/:bookingId
// @access  Private
exports.getUpiPaymentDetails = async (req, res, next) => {
  try {console.log('payment details')
    const { bookingId } = req.params;
      
    // Get booking with hostel and owner details
    const booking = await Booking.findById(bookingId)
      .populate('hostel', 'name owner ownerUpiId ownerPhone managerUpiId')
      .populate('user', 'name');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Verify ownership
    if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }
    
    // Get hostel owner details
    const hostel = await Hostel.findById(booking.hostel._id).populate('owner', 'name phone upiId');
    
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }
    
    // Determine which UPI ID to use (owner or manager)
    const ownerUpiId = hostel.ownerUpiId || hostel.managerUpiId || hostel.owner?.upiId;
    const ownerPhone = hostel.owner?.phone || hostel.ownerPhone;
    const ownerName = hostel.owner?.name || hostel.name;
    
    if (!ownerUpiId) {
      return res.status(400).json({
        success: false,
        message: 'Owner UPI ID not configured. Please contact support.'
      });
    }
    
    // Calculate amount
   const amount = Math.max(booking.monthlyRent || booking.rentAmount || 0, 10);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Generate unique transaction reference
    const transactionRef = `PG${bookingId.slice(-6)}${Date.now()}`;
    
    // Generate UPI URLs
   const deepLinks = generateAppDeepLinks(
  ownerUpiId,
  ownerName,
  amount,
  `Rent ${currentMonth}`,
  transactionRef
);
    
    // Create or get pending payment record
    let payment = await Payment.findOne({
      booking: bookingId,
      month: currentMonth
      // paymentStatus: { $in: ['pending', 'awaiting_verification'] }
    });
    
    if (!payment) {
  payment = await Payment.create({
    booking: bookingId,
    user: req.user.id,
    hostel: hostel._id,
    tenant: booking.tenant,
    month: currentMonth,
    year: new Date().getFullYear(),
    rentAmount: amount,
    totalAmount: amount,
    dueDate: new Date(new Date().setDate(1)),
    paymentMethod: 'direct_upi',
    upiPayment: {
      enabled: true,
      ownerUpiId: ownerUpiId,
      ownerPhone: ownerPhone
    },
    paymentStatus: 'pending',
    verificationStatus: 'pending'
  });
}
    
    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        amount: amount,
        ownerUpiId: ownerUpiId,
        ownerName: ownerName,
        ownerPhone: ownerPhone,
        hostelName: hostel.name,
        month: currentMonth,
        transactionRef: transactionRef,
        deepLinks: deepLinks,
        upiQrString: deepLinks.generic, // For QR generation
        instructions: [
          '1. Click "Pay with PhonePe" or copy UPI ID',
          '2. Complete payment in your UPI app',
          '3. Save the transaction screenshot',
          '4. Return and upload payment proof',
          '5. Wait for owner verification (usually within 24 hours)'
        ]
      }
    });
  } catch (error) {
    console.error('Get UPI details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Submit payment proof after UPI payment
// @route   POST /api/v1/payments/submit-proof/:paymentId
// @access  Private
exports.submitPaymentProof = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { 
      upiTransactionId, 
      paidAmount, 
      paymentDate,
      upiAppUsed,
      payerUpiId,
      notes 
    } = req.body;
    
    // Check if file was uploaded (payment proof image)
    if (!req.file && !req.body.paymentProofUrl) {
      return res.status(400).json({
        success: false,
        message: 'Payment proof image is required'
      });
    }
    
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Verify ownership
    if (payment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this payment'
      });
    }
    
    // Check if already paid
    if (payment.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment already verified'
      });
    }
    
    // Update payment with proof details
    payment.paymentProof = req.file ? req.file.path : req.body.paymentProofUrl;
    payment.paymentProofUploadedAt = new Date();
    payment.upiPayment = {
      ...payment.upiPayment,
      upiTransactionId: upiTransactionId,
      upiAppUsed: upiAppUsed,
      payerUpiId: payerUpiId
    };
    payment.amountPaid = paidAmount || payment.totalAmount;
    payment.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    payment.paymentStatus = 'awaiting_verification';
    payment.verificationStatus = 'pending';
    payment.notes = notes || `UPI payment submitted by tenant. Txn ID: ${upiTransactionId}`;
    
    await payment.save();
    
    // TODO: Send notification to owner for verification
    
    res.status(200).json({
      success: true,
      message: 'Payment proof submitted successfully. Awaiting owner verification.',
      data: {
        paymentId: payment._id,
        status: 'awaiting_verification',
        submittedAt: payment.paymentProofUploadedAt,
        estimatedVerificationTime: '24 hours'
      }
    });
  } catch (error) {
    console.error('Submit payment proof error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Verify UPI payment (Owner/Admin only)
// @route   PUT /api/v1/payments/verify/:paymentId
// @access  Private (Owner/Admin)
exports.verifyPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { status, notes } = req.body; // status: 'verified' or 'rejected'
    
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be verified or rejected'
      });
    }
    
    const payment = await Payment.findById(paymentId)
      .populate('hostel', 'owner')
      .populate('user', 'name email phone');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check if user is owner or admin
    const isOwner = payment.hostel.owner?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to verify this payment'
      });
    }
    
    // Update verification status
    payment.verificationStatus = status;
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    payment.verificationNotes = notes;
    
    if (status === 'verified') {
      payment.paymentStatus = 'paid';
      // Generate receipt number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      payment.receiptNumber = `RCP${timestamp}${random}`;
      
      // Update booking payment status
      await Booking.findByIdAndUpdate(payment.booking, {
        paymentStatus: 'paid',
        lastPaymentDate: new Date()
      });
    } else {
      payment.paymentStatus = 'pending';
      payment.amountPaid = 0;
    }
    
    await payment.save();
    
    // TODO: Send notification to tenant about verification result
    
    res.status(200).json({
      success: true,
      message: `Payment ${status} successfully`,
      data: {
        paymentId: payment._id,
        status: payment.paymentStatus,
        verificationStatus: status,
        receiptNumber: payment.receiptNumber,
        verifiedAt: payment.verifiedAt
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get pending verifications for owner
// @route   GET /api/v1/payments/pending-verifications
// @access  Private (Owner/Admin)
exports.getPendingVerifications = async (req, res, next) => {
  try {
    let query = {
      paymentStatus: 'awaiting_verification',
      verificationStatus: 'pending'
    };
    
    // If not admin, filter by owner's hostels
    if (req.user.role !== 'admin') {
      const hostels = await Hostel.find({ owner: req.user.id }).select('_id');
      const hostelIds = hostels.map(h => h._id);
      query.hostel = { $in: hostelIds };
    }
    
    const payments = await Payment.find(query)
      .populate('user', 'name email phone')
      .populate('hostel', 'name')
      .populate('booking', 'roomNumber')
      .sort({ paymentProofUploadedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Check payment status
// @route   GET /api/v1/payments/status/:paymentId
// @access  Private
exports.checkPaymentStatus = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId)
      .populate('hostel', 'name owner')
      .populate('verifiedBy', 'name');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Verify ownership
    if (payment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this payment'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.paymentStatus,
        verificationStatus: payment.verificationStatus,
        amountPaid: payment.amountPaid,
        totalAmount: payment.totalAmount,
        paymentDate: payment.paymentDate,
        verifiedAt: payment.verifiedAt,
        verifiedBy: payment.verifiedBy?.name,
        receiptNumber: payment.receiptNumber,
        paymentProof: payment.paymentProof,
        upiTransactionId: payment.upiPayment?.upiTransactionId,
        canUploadProof: payment.paymentStatus === 'pending' || payment.paymentStatus === 'awaiting_verification'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get all payments (existing - updated to include new fields)
// @route   GET /api/v1/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
  try {
    let query;
    
    if (req.user.role === 'admin') {
      query = Payment.find().populate('user hostel booking');
    } else {
      query = Payment.find({ user: req.user.id }).populate('hostel booking');
    }
    
    const payments = await query.sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single payment (existing)
// @route   GET /api/v1/payments/:id
// @access  Private
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('hostel', 'name address ownerUpiId')
      .populate('booking', 'checkInDate checkOutDate roomNumber')
      .populate('verifiedBy', 'name');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    if (payment.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this payment'
      });
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Generate monthly bills (existing - updated)
// @route   POST /api/v1/payments/generate-bills
// @access  Private
exports.generateMonthlyBills = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate bills'
      });
    }
    
    const { month } = req.body;
    
    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'checkedIn'] }
    }).populate('hostel');
    
    const generatedBills = [];
    
    for (const booking of bookings) {
      const existingBill = await Payment.findOne({
        booking: booking._id,
        month: month
      });
      
      if (!existingBill) {
        const dueDate = new Date(month);
        dueDate.setMonth(dueDate.getMonth() + 1);
        dueDate.setDate(1);
        
        const hostel = await Hostel.findById(booking.hostel._id);
        
        const bill = await Payment.create({
          booking: booking._id,
          user: booking.user,
          hostel: booking.hostel._id,
          tenant: booking.tenant,
          month: month,
          year: parseInt(month.split('-')[0]),
          rentAmount: booking.monthlyRent || booking.rentAmount,
          dueDate: dueDate,
          totalAmount: booking.monthlyRent || booking.rentAmount,
          amountPaid: 0,
          paymentStatus: 'pending',
          paymentMethod: 'direct_upi',
          upiPayment: {
            enabled: true,
            ownerUpiId: hostel?.ownerUpiId || hostel?.managerUpiId
          },
          createdBy: req.user.id
        });
        
        generatedBills.push(bill);
      }
    }
    
    res.status(201).json({
      success: true,
      count: generatedBills.length,
      data: generatedBills
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};