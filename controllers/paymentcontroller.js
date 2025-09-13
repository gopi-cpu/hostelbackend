const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Hostel = require('../models/Hostel');
const User = require('../models/User');

// @desc    Get all payments
// @route   GET /api/v1/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
  try {
    let query;
    
    // Admin can see all payments, users can only see their own
    if (req.user.role === 'admin') {
      query = Payment.find().populate('user hostel booking');
    } else {
      query = Payment.find({ user: req.user.id }).populate('hostel booking');
    }
    
    const payments = await query;
    
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

// @desc    Get single payment
// @route   GET /api/v1/payments/:id
// @access  Private
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('hostel', 'name address')
      .populate('booking', 'checkInDate checkOutDate');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Make sure user is payment owner or admin
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

// @desc    Create payment
// @route   POST /api/v1/payments
// @access  Private
exports.createPayment = async (req, res, next) => {
  try {
    const { booking, amount, paymentMethod, transactionId } = req.body;
    
    // Get booking details
    const bookingDoc = await Booking.findById(booking).populate('hostel');
    if (!bookingDoc) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Check if user owns the booking or is admin
    if (bookingDoc.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to make payment for this booking'
      });
    }
    
    // Create payment
    const payment = await Payment.create({
      ...req.body,
      user: bookingDoc.user,
      hostel: bookingDoc.hostel,
      rentAmount: bookingDoc.rentAmount,
      dueDate: new Date(), // This should be calculated based on billing cycle
      totalAmount: amount,
      amountPaid: amount,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }
};

// @desc    Generate monthly bills
// @route   POST /api/v1/payments/generate-bills
// @access  Private
exports.generateMonthlyBills = async (req, res, next) => {
  try {
    // Only admin can generate bills
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate bills'
      });
    }
    
    const { month } = req.body; // Format: YYYY-MM
    
    // Get all active bookings
    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'checkedIn'] }
    }).populate('hostel');
    
    const generatedBills = [];
    
    for (const booking of bookings) {
      // Check if bill already exists for this month
      const existingBill = await Payment.findOne({
        booking: booking._id,
        month: month
      });
      
      if (!existingBill) {
        // Calculate due date (typically 1st of next month)
        const dueDate = new Date(month);
        dueDate.setMonth(dueDate.getMonth() + 1);
        dueDate.setDate(1);
        
        const bill = await Payment.create({
          booking: booking._id,
          user: booking.user,
          hostel: booking.hostel,
          month: month,
          rentAmount: booking.rentAmount,
          dueDate: dueDate,
          totalAmount: booking.rentAmount,
          amountPaid: 0,
          paymentStatus: 'pending',
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

// @desc    Update payment
// @route   PUT /api/v1/payments/:id
// @access  Private
exports.updatePayment = async (req, res, next) => {
  try {
    let payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Only admin can update payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update payments'
      });
    }
    
    payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }
};

// @desc    Delete payment
// @route   DELETE /api/v1/payments/:id
// @access  Private
exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Only admin can delete payments
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete payments'
      });
    }
    
    await Payment.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get user payment history
// @route   GET /api/v1/payments/user/:userId
// @access  Private
exports.getUserPayments = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Users can only see their own payments, admin can see all
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these payments'
      });
    }
    
    const payments = await Payment.find({ user: userId })
      .populate('hostel', 'name address')
      .populate('booking', 'checkInDate checkOutDate')
      .sort({ paymentDate: -1 });
    
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

// @desc    Get hostel payments
// @route   GET /api/v1/payments/hostel/:hostelId
// @access  Private
exports.getHostelPayments = async (req, res, next) => {
  try {
    const { hostelId } = req.params;
    
    // Check if hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }
    
    // Only admin or hostel manager can view hostel payments
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view hostel payments'
      });
    }
    
    const payments = await Payment.find({ hostel: hostelId })
      .populate('user', 'name email phone')
      .populate('booking', 'checkInDate checkOutDate')
      .sort({ paymentDate: -1 });
    
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

// @desc    Process payment webhook
// @route   POST /api/v1/payments/webhook
// @access  Public (called by payment gateway)
exports.processPaymentWebhook = async (req, res, next) => {
  try {
    const { paymentId, transactionId, status, amount } = req.body;
    
    // Find payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Update payment status
    payment.transactionId = transactionId;
    payment.paymentStatus = status;
    payment.amountPaid = amount;
    payment.paymentDate = new Date();
    
    await payment.save();
    
    // If payment is successful, update booking status if needed
    if (status === 'completed') {
      await Booking.findByIdAndUpdate(payment.booking, {
        paymentStatus: 'paid'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get payment statistics
// @route   GET /api/v1/payments/stats
// @access  Private (Admin only)
exports.getPaymentStats = async (req, res, next) => {
  try {
    // Only admin can view payment statistics
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view payment statistics'
      });
    }
    
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amountPaid' }
        }
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: '$count' },
          totalRevenue: { $sum: '$totalAmount' },
          statusCounts: { $push: { status: '$_id', count: '$count', amount: '$totalAmount' } }
        }
      }
    ]);
    
    // Monthly revenue
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          paymentDate: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' }
          },
          revenue: { $sum: '$amountPaid' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        overall: stats.length > 0 ? stats[0] : { totalPayments: 0, totalRevenue: 0, statusCounts: [] },
        monthlyRevenue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};