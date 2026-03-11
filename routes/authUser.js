const express = require("express");
const router = express.Router();
const {
  registerUser,
  verifyUser,
  loginUser,
  getProfile,
  forgotPassword,
  resetPassword,
  addFavorite,
  removeFavorite,
  getUserDashboard,
  getProfileWithHostels
} = require("../controllers/authControllers");
const { protect } = require("../middleware/authMiddleware");
const Property = require('../models/hostelschema');
const MaintenanceTicket = require('../models/Maintenance');
const Message = require('../models/message');
const Booking = require('../models/bookingschema');

const asyncHandler = require('express-async-handler');

// Auth
router.post("/register", registerUser);
router.get("/verify/:token", verifyUser); 
router.post("/login", loginUser);

// Profile
router.get("/profile", protect, getProfile);
router.get('/profile/hostel', protect, getProfileWithHostels);

// Password Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Favorites
router.post("/favorites", protect, addFavorite);
router.delete("/favorites", protect, removeFavorite);
router.get('/dashboard', protect, getUserDashboard);

// @desc    Get PG details for user's current stay
// @route   GET /api/auth/pg-details
// @access  Private
const formatMessage = (msg, populate = true) => ({
  _id: msg._id,
  text: msg.m,
  type: ['text', 'image', 'file', 'system'][msg.t] || 'text',
  issueType: ['general', 'maintenance', 'payment', 'complaint', 'other'][msg.i] || 'general',
  status: ['sent', 'delivered', 'read'][msg.st] || 'sent',
  createdAt: msg.c,
  updatedAt: msg.u,
  readAt: msg.ra || null,
  sender: populate ? {
    _id: msg.s?._id || msg.s,
    name: msg.s?.name || msg.s?.n || 'Unknown'
  } : msg.s,
  receiver: populate ? {
    _id: msg.r?._id || msg.r,
    name: msg.r?.name || msg.r?.n || 'Unknown'
  } : msg.r,
  property: msg.p,
  metadata: msg.meta ? {
    url: msg.meta.u,
    name: msg.meta.n,
    size: msg.meta.s
  } : null,
  replyTo: msg.rt || null
});



router.get('/pg-details', protect, asyncHandler(async (req, res) => {
  
  // Find user's active booking
  const booking = await Booking.findOne({ 
    user: req.user._id,
    status: { $in: ['active', 'confirmed', 'checked-in'] }
  })
  .populate('hostel', 'name address images rating reviews amenities roomType foodType owner')
  .populate('room', 'roomNumber type rent')
  .sort({ createdAt: -1 });
  console.log('booking',booking)


  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'No active booking found'
    });
  }

  // Get property details with owner info
  const property = await Property.findById(booking.hostel._id)
    .populate('owner', 'name phone email _id');

  if (!property) {
    return res.status(404).json({
      success: false,
      message: 'Property not found'
    });
  }

  // Calculate days remaining
  const today = new Date();
  const endDate = new Date(booking.endDate);
  const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

  res.json({
    success: true,
        data: {
        booking: {
      _id: booking._id,
      startDate: booking.checkInDate,
      endDate: booking.checkOutDate,
      status: booking.status,
      roomNumber: booking.room?.roomNumber || null,
      roomId: booking.room?._id,
      bedId: booking.bed,
      securityDeposit: booking.securityDeposit,
      monthlyRent: booking.rentAmount
    },
      pgDetails: {
        _id: property._id,
        name: property.name,
        address: property.address,
        description: property.description,
        images: property.images,
        rating: property.rating,
        amenities: property.amenities,
        roomType: property.roomType,
        foodType: property.foodType,
        monthlyRent: booking.monthlyRent,
        owner: {
          _id: property.owner?._id,
          name: property.owner?.name,
          phone: property.owner?.phone,
          email: property.owner?.email
        }
      },
      stayInfo: {
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        totalDays: Math.ceil(
          (new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24)
        ),
        checkInDate: booking.startDate,
        checkOutDate: booking.endDate
      }
    }
  });
}));

// @desc    Get maintenance tickets for user's PG
// @route   GET /api/auth/maintenance-tickets
// @access  Private
router.get('/maintenance-tickets', protect, asyncHandler(async (req, res) => {
  // Find user's active booking to get property ID
  const booking = await Booking.findOne({ 
    user: req.user._id,
    status: { $in: ['active', 'confirmed', 'checked-in'] }
  });

  if (!booking) {
    return res.json({
      success: true,
      data: []
    });
  }

  // Get tickets for this user and property
  const tickets = await MaintenanceTicket.find({
    $or: [
      { user: req.user._id },
      { property: booking.hostel } // Fixed: use booking.hostel instead of booking.property
    ]
  })
  .populate('property', 'name')
  .populate('assignedTo', 'name')
  .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: tickets.map(ticket => ({
      _id: ticket._id,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      propertyName: ticket.property?.name,
      assignedTo: ticket.assignedTo?.name,
      images: ticket.images || []
    }))
  });
}));

// @desc    Get messages for a specific PG/conversation
// @route   GET /api/auth/messages/:pgId
// @access  Private
router.get('/messages/:pgId', protect, asyncHandler(async (req, res) => {
  const { pgId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);

    // Verify user has booking at this property
  const hasBooking = await Booking.exists({
    user: req.user._id,
    hostel: pgId,
    status: { $in: ['active', 'confirmed', 'checked-in'] }
  });
  
  if (!hasBooking) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. No active booking at this property.'
    });
  }

  // Use lean() for faster queries, select only needed fields
  const messages = await Message.find({
    p: pgId,
    $or: [
      { s: req.user._id },
      { r: req.user._id }
    ]
  })
  .populate('s', 'name')      // Only get sender name
  .populate('r', 'name')      // Only get receiver name
  .sort({ c: -1 })            // Sort by createdAt desc
  .skip(skip)
  .limit(parseInt(limit))
  .lean();                    // Return plain JS objects (faster)

  // Transform to readable format for frontend
  const formattedMessages = messages.map(msg => ({
    _id: msg._id,
    text: msg.m,
    type: ['text', 'image', 'file'][msg.t] || 'text',
    issueType: ['general', 'maintenance', 'payment', 'complaint', 'other'][msg.i] || 'general',
    status: ['sent', 'delivered', 'read'][msg.st] || 'sent',
    createdAt: msg.c,
    updatedAt: msg.u,
    readAt: msg.ra,
    sender: {
      _id: msg.s._id || msg.s,
      name: msg.s.name || 'Unknown'
    },
    receiver: {
      _id: msg.r._id || msg.r,
      name: msg.r.name || 'Unknown'
    },
    metadata: msg.meta || null,
    replyTo: msg.rt || null
  }));

  // Mark messages as delivered (batch update for performance)
  const messageIds = messages
    .filter(m => m.r.toString() === req.user._id.toString() && m.st === 0)
    .map(m => m._id);

  if (messageIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $set: { st: 1 } }  // Mark as delivered
    );
  }

  res.json({
    success: true,
    data: formattedMessages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: messages.length === parseInt(limit)
    }
  });
}));

// @desc    Send message to PG owner
// @route   POST /api/auth/message-owner
// @access  Private
// @access  Private
router.post('/message-owner', protect, asyncHandler(async (req, res) => {
  const { message, issueType = 'general', pgId, receiverId } = req.body;

  if (!message?.trim() || !pgId) {
    return res.status(400).json({
      success: false,
      message: 'Message and PG ID required'
    });
  }

  const validIssueTypes = ['general', 'maintenance', 'payment', 'complaint', 'other'];
if (!validIssueTypes.includes(issueType.toLowerCase())) {
  return res.status(400).json({
    success: false,
    message: 'Invalid issue type'
  });
}

  // Map string values to numbers for storage
  const issueTypeMap = {
    'general': 0,
    'maintenance': 1,
    'payment': 2,
    'complaint': 3,
    'other': 4
  };

  // Get owner if receiverId not provided
  let rId = receiverId;
  if (!rId) {
    const property = await Property.findById(pgId).select('owner');
    rId = property?.owner;
  }

  if (!rId) {
    return res.status(400).json({ success: false, message: 'Receiver not found' });
  }

  // Create message with short field names
  const newMessage = await Message.create({
    s: req.user._id,
    r: rId,
    p: pgId,
    m: message.trim().slice(0, 2000),  // Limit length
    t: 0,  // text
    i: issueTypeMap[issueType.toLowerCase()] || 0,
    st: 0   // sent
  });

  // Return in readable format
  res.status(201).json({
    success: true,
    data: {
      _id: newMessage._id,
      text: newMessage.m,
      type: 'text',
      issueType: issueType.toLowerCase(),
      status: 'sent',
      createdAt: newMessage.c,
      sender: { _id: req.user._id, name: req.user.name },
      receiver: { _id: rId }
    }
  });
}));

// @desc    Mark messages as read
// @route   PUT /api/auth/messages/read
// @access  Private
router.put('/messages/read', protect, asyncHandler(async (req, res) => {
  const { messageIds } = req.body;

  if (!messageIds || !Array.isArray(messageIds)) {
    return res.status(400).json({
      success: false,
      message: 'Message IDs array is required'
    });
  }

  await Message.updateMany(
    {
      _id: { $in: messageIds },
      r: req.user._id  // Changed from 'receiver' to 'r'
    },
    { 
      $set: {
        st: 2,        // Changed from 'status' to 'st' (2 = read)
        ra: new Date() // Changed from 'readAt' to 'ra'
      }
    }
  );

  res.json({
    success: true,
    message: 'Messages marked as read'
  });
}));

// @desc    Get unread messages count
// @route   GET /api/auth/unread-messages
// @access  Private
router.get('/unread-messages', protect, asyncHandler(async (req, res) => {
  const count = await Message.countDocuments({
    r: req.user._id,      // Changed from 'receiver' to 'r'
    st: { $in: [0, 1] }   // Changed from 'status' to 'st' (0=sent, 1=delivered)
  });

  const unreadByProperty = await Message.aggregate([
    {
      $match: {
        r: req.user._id,    // Changed from 'receiver' to 'r'
        st: { $in: [0, 1] } // Changed from 'status' to 'st'
      }
    },
    {
      $group: {
        _id: '$p',          // Changed from '$property' to '$p'
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: { 
      total: count,
      byProperty: unreadByProperty
    }
  });
}));

// @desc    Get all conversations for user
// @route   GET /api/auth/conversations
// @access  Private
router.get('/conversations', protect, asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate('hostel', 'name images owner')
    .populate('hostel.owner', 'name phone email');

  if (!bookings.length) {
    return res.json({ success: true, data: [] });
  }

  const propertyIds = bookings.map(b => b.hostel._id);

  // Single aggregation for all data
  const messageStats = await Message.aggregate([
    {
      $match: {
        p: { $in: propertyIds },
        $or: [{ s: req.user._id }, { r: req.user._id }]
      }
    },
    {
      $sort: { c: -1 }
    },
    {
      $group: {
        _id: '$p',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$r', req.user._id] },
                { $in: ['$st', [0, 1]] }
              ]},
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  // Create lookup map
  const statsMap = new Map(messageStats.map(s => [s._id.toString(), s]));

  const conversations = bookings.map(booking => {
    const propId = booking.hostel._id.toString();
    const stats = statsMap.get(propId);
    
    return {
      _id: propId,
      pgId: propId,
      pgName: booking.hostel?.name || 'Unknown PG',
      ownerName: booking.hostel?.owner?.name || 'Property Owner',
      ownerId: booking.hostel?.owner?._id,
      lastMessage: stats?.lastMessage ? {
        text: stats.lastMessage.m,
        createdAt: stats.lastMessage.c,
        sender: stats.lastMessage.s.toString() === req.user._id.toString() 
          ? 'You' 
          : 'Owner' // Simplified, fetch name if needed
      } : null,
      unreadCount: stats?.unreadCount || 0,
      bookingStatus: booking.status
    };
  });

  conversations.sort((a, b) => {
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
  });

  res.json({ success: true, data: conversations });
}));
// @desc    Get user-specific payment history
// @route   GET /api/auth/payments
// @access  Private
router.get('/payments', protect, asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ 
    user: req.user._id,
    status: { $in: ['active', 'confirmed', 'checked-in', 'completed'] }
  }).populate('payments');

  if (!booking || !booking.payments) {
    return res.json({
      success: true,
      data: []
    });
  }

  res.json({
    success: true,
    data: booking.payments
  });
}));

module.exports = router;