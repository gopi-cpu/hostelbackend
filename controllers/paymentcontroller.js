const Payment = require('../models/paymentSchema');
const Booking = require('../models/bookingschema');
const Hostel = require('../models/hostelschema');
const User = require('../models/authUser');
const Tenants = require('../models/tenants')
const { v4: uuidv4 } = require('uuid');

// Helper function to generate UPI URL
const generateUpiUrl = (upiId, name, amount, transactionNote,transactionRef) => {
  const encodedName = encodeURIComponent(name);
  const encodedNote = encodeURIComponent(transactionNote);

  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${transactionRef}`;
};

// Helper function to generate deep links for specific apps
const generateAppDeepLinks = (upiId, name, amount, note, transactionRef) => {
  const encodedName = encodeURIComponent(name);
  const encodedNote = encodeURIComponent(note);

  return {
    generic: `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}&tr=${transactionRef}`,

    phonepe: `phonepe://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}&tr=${transactionRef}`,

    googlePay: `tez://upi/pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}&tr=${transactionRef}`,

    paytm: `paytmmp://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}&tr=${transactionRef}`,

    amazonPay: `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedNote}&tr=${transactionRef}`
  };
};

// @desc    Get UPI payment details for a booking
// @route   GET /api/v1/payments/upi-details/:bookingId
// @access  Private
exports.getUpiPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params; // Now use paymentId instead of bookingId
      console.log('paymentid',paymentId)
    const payment = await Payment.findById(paymentId)
      .populate('hostel', 'name ownerUpiId ownerPhone managerUpiId')
      .populate('tenant', 'name');

        console.log('payment',payment)
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    
    // Verify this payment belongs to the user
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const ownerUpiId = payment.hostel.ownerUpiId || payment.hostel.managerUpiId;
    if (!ownerUpiId) {
      return res.status(400).json({ success: false, message: 'UPI ID not configured' });
    }
    
    const transactionRef = `PG${payment._id.toString().slice(-6)}${Date.now()}`;
    
    // Generate deep links
    const deepLinks = {
      generic: `upi://pay?pa=${ownerUpiId}&pn=${encodeURIComponent(payment.hostel.name)}&am=${payment.totalAmount}&cu=INR&tn=Rent_${payment.month}&tr=${transactionRef}`,
      phonepe: `phonepe://pay?pa=${ownerUpiId}&pn=${encodeURIComponent(payment.hostel.name)}&am=${payment.totalAmount}&cu=INR&tn=Rent_${payment.month}&tr=${transactionRef}`,
      googlePay: `tez://upi/pay?pa=${ownerUpiId}&pn=${encodeURIComponent(payment.hostel.name)}&am=${payment.totalAmount}&cu=INR&tn=Rent_${payment.month}&tr=${transactionRef}`,
      paytm: `paytmmp://pay?pa=${ownerUpiId}&pn=${encodeURIComponent(payment.hostel.name)}&am=${payment.totalAmount}&cu=INR&tn=Rent_${payment.month}&tr=${transactionRef}`
    };
    
    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        amount: payment.totalAmount,
        month: payment.month,
        ownerUpiId,
        hostelName: payment.hostel.name,
        transactionRef,
        deepLinks,
        instructions: [
          '1. Click your preferred UPI app',
          '2. Complete the payment',
          '3. Save the transaction screenshot',
          '4. Return to this app and upload',
          '5. Wait for owner verification'
        ]
      }
    });
  } catch (error) {
    console.log('error',error)
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Submit payment proof after UPI payment
// @route   POST /api/v1/payments/submit-proof/:paymentIdpaymentProof
// @access  Private
exports.submitPaymentProof = async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log('payment id ',paymentId)
    const { upiTransactionId, upiAppUsed, payerUpiId, notes } = req.body;

      const proofUrl = req.file?.location || req.body.paymentProofUrl;
      console.log('paymentprod',proofUrl)
    // Check file uploaded
    if (!proofUrl) {
      return res.status(400).json({ success: false, message: 'Payment proof required' });
    }
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    // Verify ownership
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    // Update payment
    payment.upiPayment = {
      ...payment.upiPayment,
      upiTransactionId,
      upiAppUsed,
      payerUpiId,
      paymentProofUploadedAt: new Date()
    };
     payment.paymentProof= proofUrl,
    payment.amountPaid = payment.totalAmount;
    payment.paymentStatus = 'awaiting_verification';
    payment.verificationStatus = 'pending';
    payment.paymentMethod = 'upi';
    payment.notes = notes || `UPI payment submitted. Txn: ${upiTransactionId}`;
    
    await payment.save();
    
    // TODO: Notify owner
    
    res.json({
      success: true,
      message: 'Payment proof submitted. Awaiting verification.',
      data: {
        paymentId: payment._id,
        status: 'awaiting_verification',
        submittedAt: payment.upiPayment.paymentProofUploadedAt
      }
    });
  } catch (error) {
    console.log('error',error.message)
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordCashPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, notes, paidDate = new Date() } = req.body;
    const ownerId = req.user.id;
    console.log('amount',amount,paymentId,notes)
    const payment = await Payment.findById(paymentId)
      .populate('tenant', 'name phone')
      .populate('hostel', 'name owner');
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    // Verify owner
    if (payment.hostel.owner.toString() !== ownerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    // Update payment as paid (no verification needed for cash)
    payment.amountPaid = amount || payment.totalAmount;
    payment.paymentStatus = 'paid';
    payment.paymentMethod = 'cash';
    payment.verificationStatus = 'not_required';
    payment.verifiedBy = ownerId;
    payment.verifiedAt = new Date();
    payment.recordedBy = ownerId;
    payment.notes = notes || 'Cash payment recorded by owner';
    
    // Generate receipt
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    payment.receiptNumber = `RCP${timestamp}${random}`;
    
    await payment.save();
    
    // Update tenant's next due date
    const tenant = await Tenants.findById(payment.tenant);
    const nextDue = new Date(payment.dueDate);
    nextDue.setMonth(nextDue.getMonth() + 1);
    tenant.rentDueDay = nextDue.getDate();
    await tenant.save();
    
    // TODO: Send confirmation to tenant
    
    res.json({
      success: true,
      message: 'Cash payment recorded',
      data: {
        paymentId: payment._id,
        receiptNumber: payment.receiptNumber,
        status: 'paid',
        nextDueDate: nextDue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify UPI payment (Owner/Admin only)
// @route   PUT /api/v1/payments/verify/:paymentId
// @access  Private (Owner/Admin)
exports.verifyPayment = async (req, res) => {
  try {
    console.log("=== [START] verifyPayment ===");

    const { paymentId } = req.params;
    const { status, notes } = req.body; // 'verified' or 'rejected'
    const ownerId = req.user.id;

    console.log("[INPUT] paymentId:", paymentId);
    console.log("[INPUT] status:", status);
    console.log("[INPUT] notes:", notes);
    console.log("[USER] ownerId:", ownerId, "role:", req.user.role);

    // Validate status
    if (!['verified', 'rejected'].includes(status)) {
      console.log("[ERROR] Invalid status:", status);
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    console.log("[STEP] Fetching payment from DB...");

    const payment = await Payment.findById(paymentId)
      .populate('tenant', 'name phone userId')
      .populate('hostel', 'name owner');

    console.log("[DB] Payment fetched:", payment ? "FOUND" : "NOT FOUND");

    if (!payment) {
      console.log("[ERROR] Payment not found");
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    console.log("[PAYMENT DATA]", {
      id: payment._id,
      currentStatus: payment.paymentStatus,
      verificationStatus: payment.verificationStatus,
      dueDate: payment.dueDate,
      hostelOwner: payment.hostel.owner.toString()
    });

    // Verify owner
    if (payment.hostel.owner.toString() !== ownerId && req.user.role !== 'admin') {
      console.log("[ERROR] Unauthorized access");
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    console.log("[STEP] Updating verification fields...");

    payment.verificationStatus = status;
    payment.verifiedBy = ownerId;
    payment.verifiedAt = new Date();
    payment.verificationNotes = notes;

    if (status === 'verified') {
      console.log("[FLOW] VERIFIED branch");

      // APPROVE
      payment.paymentStatus = 'paid';
      payment.amountPaid = payment.amountPaid || payment.totalAmount;

      console.log("[STEP] Generating receipt...");
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      payment.receiptNumber = `RCP${timestamp}${random}`;
      console.log("[RECEIPT]", payment.receiptNumber);

      console.log("[STEP] Fetching tenant...");
      const tenant = await Tenants.findById(payment.tenant);

      if (!tenant) {
        console.log("[ERROR] Tenant not found");
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      console.log("[TENANT DATA]", {
        id: tenant._id,
        name: tenant.name,
        currentRentDueDay: tenant.rentDueDay
      });

      console.log("[STEP] Calculating next due date...");
      const nextDue = new Date(payment.dueDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      console.log("[NEXT DUE DATE]", nextDue);

      tenant.rentDueDay = nextDue.getDate();

      console.log("[STEP] Saving tenant...");
      await tenant.save();
      console.log("[SUCCESS] Tenant updated");

    } else {
      console.log("[FLOW] REJECTED branch");

      // REJECT
      payment.paymentStatus = 'pending';
      payment.amountPaid = 0;

      console.log("[INFO] Payment reset for retry");
    }

    console.log("[STEP] Saving payment...");
    await payment.save();
    console.log("[SUCCESS] Payment saved");

    console.log("=== [END SUCCESS] verifyPayment ===");

    res.json({
      success: true,
      message: `Payment ${status}`,
      data: {
        paymentId: payment._id,
        status: payment.paymentStatus,
        receiptNumber: payment.receiptNumber,
        verificationStatus: status
      }
    });

  } catch (error) {
    console.error("=== [ERROR] verifyPayment ===");
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllPayments = async (req, res) => {
  try {
    const { status, month, hostelId, page = 1, limit = 50 } = req.query;
    const ownerId = req.user.id;
    
    // Build query
    let query = {};
    
    // Filter by owner's hostels
   if (hostelId) {
  // ✅ filter by selected hostel
      query.hostel = hostelId;
    } else if (req.user.role !== 'admin') {
      // fallback (optional)
      const hostels = await Hostel.find({ owner: ownerId });
      query.hostel = { $in: hostels.map(h => h._id) };
    }
    if (month) query.month = month;
    if (status) query.paymentStatus = status;
    
    const payments = await Payment.find(query)
      .populate('tenant', 'name phone roomNumber bedNumber')
      .populate('user', 'name email phone')
      .populate('hostel', 'name')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Calculate stats
    const stats = {
      total: await Payment.countDocuments(query),
      pending: await Payment.countDocuments({ ...query, paymentStatus: 'pending' }),
      awaitingVerification: await Payment.countDocuments({ ...query, paymentStatus: 'awaiting_verification' }),
      paid: await Payment.countDocuments({ ...query, paymentStatus: 'paid' }),
      rejected: await Payment.countDocuments({ ...query, verificationStatus: 'rejected' }),
      totalAmount: payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0)
    };
    
    res.json({
      success: true,
      stats,
      payments: payments.map(p => ({
        _id: p._id,
        tenantName: p.tenant?.name,
        tenantPhone: p.tenant?.phone,
        roomNumber: p.tenant?.roomNumber,
        month: p.month,
        amount: p.totalAmount,
        amountPaid: p.amountPaid,
        dueDate: p.dueDate,
        status: p.paymentStatus,
        verificationStatus: p.verificationStatus,
        paymentMethod: p.paymentMethod,
        receiptNumber: p.receiptNumber,
        proofUrl: p.upiPayment?.paymentProofUrl,
        submittedAt: p.upiPayment?.paymentProofUploadedAt,
        verifiedAt: p.verifiedAt,
        verifiedBy: p.verifiedBy?.name,
        canVerify: p.paymentStatus === 'awaiting_verification'
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pending verifications for owner
// @route   GET /api/v1/payments/pending-verifications
// @access  Private (Owner/Admin)
exports.getPendingVerifications = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { hostelId } = req.query;
    
    let query = {
      paymentStatus: 'awaiting_verification',
      verificationStatus: 'pending'
    };
    
   if (hostelId) {
      query.hostel = hostelId;
    } else if (req.user.role !== 'admin') {
      const hostels = await Hostel.find({ owner: ownerId });
      query.hostel = { $in: hostels.map(h => h._id) };
    }
    
    const payments = await Payment.find(query)
      .populate('tenant', 'name phone roomNumber bedNumber')
      .populate('user', 'name email phone')
      .populate('hostel', 'name')
      .sort({ 'upiPayment.paymentProofUploadedAt': -1 });
    
    res.json({
      success: true,
      count: payments.length,
      data: payments.map(p => ({
        _id: p._id,
        tenantName: p.tenant?.name,
        tenantPhone: p.tenant?.phone,
        roomNumber: p.tenant?.roomNumber,
        bedNumber: p.tenant?.bedNumber,
        hostelName: p.hostel?.name,
        month: p.month,
        amount: p.totalAmount,
        dueDate: p.dueDate,
        submittedAt: p.upiPayment?.paymentProofUploadedAt,
        upiTransactionId: p.upiPayment?.upiTransactionId,
        upiAppUsed: p.upiPayment?.upiAppUsed,
        payerUpiId: p.upiPayment?.payerUpiId,
        proofUrl: p.upiPayment?.paymentProofUrl,
        status: 'awaiting_verification'
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
// exports.getPayments = async (req, res, next) => {
//   try {
//     let query;
//     console.log('first payment')
//     if (req.user.role === 'admin') {
//       query = Payment.find().populate('user hostel booking');
//     } else {
//       query = Payment.find({ user: req.user.id }).populate('hostel booking');
//     }
    
//     const payments = await query.sort({ createdAt: -1 });
    
//     res.status(200).json({
//       success: true,
//       count: payments.length,
//       data: payments
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server Error'
//     });
//   }
// };

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
exports.generateMonthlyBills = async (req, res) => {
  try {
   
    const { month, hostelId } = req.body; // "2026-04"
    const ownerId = req.user.id;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month is required (format: YYYY-MM)'
      });
    }

    // ✅ Extract year & month properly
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const monthIndex = parseInt(monthStr) - 1;

    if (isNaN(year) || isNaN(monthIndex)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format'
      });
    }

    // ✅ Get tenants
    const query = { status: 'active' };

    if (hostelId) {
      query.hostelId = hostelId;
    } else {
      const hostels = await Hostel.find({ owner: ownerId });
      query.hostelId = { $in: hostels.map(h => h._id) };
    }

    const tenants = await Tenants.find(query);
  
    if (!tenants.length) {
      return res.status(200).json({
        success: true,
        message: 'No active tenants found',
        generated: [],
        skipped: []
      });
    }

    const generatedBills = [];
    const skippedBills = [];

    for (const tenant of tenants) {
      try {
        // ✅ Check existing bill
        const existing = await Payment.findOne({
          tenant: tenant._id,
          month: month
        });

        console.log('existing bill for:', tenant.name, existing);

        if (existing) {
          skippedBills.push({
            tenant: tenant.name,
            reason: 'Already exists'
          });
          continue;
        }

        // ✅ Safe due date
        const dueDate = new Date(
          year,
          monthIndex,
          tenant.rentDueDay || 5
        );

        if (isNaN(dueDate.getTime())) {
          skippedBills.push({
            tenant: tenant.name,
            reason: 'Invalid due date'
          });
          continue;
        }

        // ✅ Get hostel
        const hostel = await Hostel.findById(tenant.hostelId);
   

        const upiId = hostel?.ownerUpiId || hostel?.managerUpiId;
          
        if (!upiId) {
          skippedBills.push({
            tenant: tenant.name,
            reason: 'UPI ID missing'
          });
          continue;
        }


        const bookingDoc = await Booking.findOne({
              user: tenant.userId,
              hostel: tenant.hostelId
            }).sort({ createdAt: -1 });

     
        // ✅ Create payment
        const payment = await Payment.create({
          tenant: tenant._id,
          user: tenant.userId,
          hostel: tenant.hostelId,

          // ⚠️ If booking is required in schema
          booking: bookingDoc?._id || null,

          month: month,
          year: year,

          rentAmount: tenant.monthlyRent || 0,
          totalAmount: tenant.monthlyRent || 0,

          dueDate: dueDate,

          paymentStatus: 'pending',
          verificationStatus: 'not_required',

          upiPayment: {
            enabled: true,
            ownerUpiId: upiId
          },

          createdBy: ownerId
        });

        generatedBills.push(payment);

      } catch (err) {
         console.error('❌ FULL ERROR for tenant:', err);
        skippedBills.push({
          tenant: tenant.name,
          reason: err.message
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Generated ${generatedBills.length} bills, skipped ${skippedBills.length}`,
      generated: generatedBills,
      skipped: skippedBills
    });

  } catch (error) {
    console.error('Generate Bills Error:', error);
  
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getUserDuePayments = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find tenant for this user
    const tenant = await Tenants.findOne({ userId, status: 'active' })
      .populate('hostelId', 'name address ownerUpiId');
    
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'No active tenancy found' });
    }
    
    // Get all payments for this tenant
    const payments = await Payment.find({ tenant: tenant._id })
      .sort({ dueDate: -1 });
    
    // Calculate stats
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentPayment = payments.find(p => p.month === currentMonth);
    
    const duePayments = payments.map(p => ({
      _id: p._id,
      month: p.month,
      rentAmount: p.rentAmount,
      totalAmount: p.totalAmount,
      amountPaid: p.amountPaid,
      dueDate: p.dueDate,
      daysUntilDue: Math.ceil((p.dueDate - new Date()) / (1000 * 60 * 60 * 24)),
      isOverdue: new Date() > p.dueDate && p.paymentStatus !== 'paid',
      status: p.paymentStatus,
      verificationStatus: p.verificationStatus,
      paymentMethod: p.paymentMethod,
      canPayOnline: p.upiPayment?.enabled && p.paymentStatus === 'pending',
      receiptNumber: p.receiptNumber,
      
      // ✅ FIXED: Include payment proof (screenshot) - check both possible field names
      paymentProof: p.paymentProof || p.upiPayment?.paymentProofUrl || null,
      
      // For UPI payments awaiting verification
      proofSubmitted: !!(p.paymentProof || p.upiPayment?.paymentProofUrl),
      submittedAt: p.upiPayment?.paymentProofUploadedAt || p.verifiedAt
    }));
    
    res.json({
      success: true,
      tenant: {
        name: tenant.name,
        hostelName: tenant.hostelId.name,
        monthlyRent: tenant.monthlyRent,
        rentDueDay: tenant.rentDueDay
      },
      currentMonth,
      payments: duePayments,
      stats: {
        totalDue: payments.filter(p => p.paymentStatus !== 'paid').length,
        totalPaid: payments.filter(p => p.paymentStatus === 'paid').length,
        awaitingVerification: payments.filter(p => p.paymentStatus === 'awaiting_verification').length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// GET /api/v1/payments - Get ALL payments for owner/admin
exports.getPayments = async (req, res, next) => {
  try {
    console.log('njckas')
    let query = {}
    
    // If owner, filter by their hostels
       const { hostelId } = req.params;
    console.log('hostelid',hostelId)
      if (req.user.role === 'owner') {
        if (hostelId) {
          query.hostel = hostelId;  // ✅ IMPORTANT
        } else {
          const hostels = await Hostel.find({ owner: req.user.id });
          query.hostel = { $in: hostels.map(h => h._id) };
        }
      }
    
    const payments = await Payment.find(query)
      .populate('user', 'name email phone')
      .populate('hostel', 'name')
      .populate('booking', 'roomNumber')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 });


      console.log('payments',payments)
    
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