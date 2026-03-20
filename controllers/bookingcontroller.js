// controllers/bookingController.js
const Booking = require('../models/bookingschema');
const Room = require('../models/roomSchema');
const Property  = require('../models/hostelschema');
const Student = require('../models/tenants');
const User = require('../models/authUser');
const mongoose = require('mongoose');

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private (Admin/Owner sees all relevant, User sees own)
exports.getBookings = async (req, res) => {
  try {
    console.log('get bookings',req.query.status,req.user.role)
    let query = {};
    let populateOptions = [
      { path: 'user', select: 'name email phone profileImage' },
      { path: 'hostel', select: 'name address images' },
      { path: 'room', select: 'roomNumber floor roomType' },
    ];

    // Role-based filtering
    if (req.user.role === 'user' || req.user.role === 'student') {
      // Regular users see their own bookings
      query.user = req.user.id;
    } else if (req.user.role === 'owner') {
      // Owners see bookings for their hostels
      const ownerHostels = await Property.find({ owner: req.user.id }).select('_id');
      const hostelIds = ownerHostels.map(h => h._id);
      query.hostel = { $in: hostelIds };
    }
    // Admins see all (no filter)

    // Additional filters from query params
    if (req.query.status) query.status = req.query.status;
    if (req.query.hostel) query.hostel = req.query.hostel;
    if (req.query.upcoming === 'true') {
      query.checkInDate = { $gte: new Date() };
    }
    if (req.query.active === 'true') {
      query.status = { $in: ['checkedIn', 'confirmed'] };
      }
        console.log('query',query)
    const bookings = await Booking.find(query)
      .populate(populateOptions)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
exports.getBooking = async (req, res) => {
  try {
    
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email phone profileImage')
      .populate('hostel', 'name address contact amenities images')
      .populate('room', 'roomNumber floor roomType amenities beds')
      .populate('student', 'studentId status emergencyContact');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Authorization check
    const isOwner = booking.hostel.owner?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isUser = booking.user._id.toString() === req.user.id;

    if (!isUser && !isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      hostel,
      room,
      bed,
      checkInDate,
      durationMonths,
      emergencyContact,
      documents
    } = req.body;
   
    // Validate required fields
    if (!hostel || !room || !bed || !checkInDate || !durationMonths || !emergencyContact) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: hostel, room, bed, checkInDate, durationMonths, emergencyContact'
      });
    }



    // Check if room and bed exist and are available
    const roomDoc = await Room.findById(room).session(session);
    if (!roomDoc) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const bedInfo = roomDoc.beds.id(bed);
    if (!bedInfo) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bed not found in this room'
      });
    }

    if (bedInfo.isOccupied || bedInfo.status !== 'available') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Bed is already occupied or not available'
      });
    }

    // Check for existing active booking by this user in this hostel
    const existingBooking = await Booking.findOne({
      user: req.user.id,
      hostel: hostel,
      status: { $in: ['pending', 'confirmed', 'checkedIn'] }
    }).session(session);

    if (existingBooking) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'You already have an active booking in this hostel'
      });
    }

       const user = await User.findById(req.user.id).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

     const hostelData = await Property.findById(hostel)
      .populate('owner', 'name email phone')
      .session(session);

    if (!hostelData) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Hostel not found' });
    }

    let tenant = await Student.findOne({
      userId: user._id,
      hostelId: hostel,
      status: { $in: ['active', 'suspended'] }
    }).session(session);

    let isNewTenant = false;

    if (!tenant) {
      // Create new tenant record
      isNewTenant = true;
      tenant = new Student({
        name: user.name,
        email: user.email,
        phone: user.phone,
        hostelId: hostel,
        userId: user._id,
        room: room,
        roomNumber: roomDoc.roomNumber,
        bedId: bed,
        bedNumber: bedInfo.bedNumber,
        status: 'active',
        source: 'booking-system',
        createdBy: 'booking-system',
        hasLoginAccess: true,
        checkInDate: new Date(checkInDate),
        emergencyContact: emergencyContact || {}
      });
      await tenant.save({ session });

      // Link tenant to user
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { studentProfiles: tenant._id }
      }, { session });

   
    } else {
      // Update existing tenant with new room/bed
      tenant.room = room;
      tenant.roomNumber = roomDoc.roomNumber;
      tenant.bedId = bed;
      tenant.bedNumber = bedInfo.bedNumber;
      tenant.status = 'active';
      await tenant.save({ session });
 
    }


    // Calculate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkIn);
    checkOut.setMonth(checkOut.getMonth() + parseInt(durationMonths));

    // Calculate amounts
    const monthlyRent = bedInfo.rentAmount || roomDoc.baseRent;
    const totalRent = monthlyRent * parseInt(durationMonths);
    const totalAmount = monthlyRent * parseInt(durationMonths);
    const securityDeposit = monthlyRent; // One month as security

    // Create booking
     const booking = await Booking.create([{
      user: req.user.id,
      hostel: hostel,
      room: room,
      bed: bed,
      student: tenant._id, // Link to tenant
      checkInDate: checkIn,
      checkOutDate: checkOut,
      rentAmount: monthlyRent,
      securityDeposit: securityDeposit,
      totalAmount: totalAmount,
      pendingAmount: totalAmount,
      durationMonths: parseInt(durationMonths),
      emergencyContact: emergencyContact,
      documents: documents || [],
      status: 'pending',
      createdBy: 'user-booking'
    }], { session });
    // Temporarily hold the bed (optional - depends on your business logic)
    // You might want to reserve it only after payment or confirmation

      bedInfo.isOccupied = true;
    bedInfo.status = 'reserved';
    bedInfo.reservationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr hold
    bedInfo.reservedBy = req.user.id;
    bedInfo.studentId = tenant._id;
    bedInfo.studentName = user.name;
    bedInfo.studentPhone = user.phone;
    bedInfo.studentEmail = user.email;
    await roomDoc.save({ session });
    
    await session.commitTransaction();
    
           try {
      const io = req.app.get('io');
      const connectedOwners = req.app.get('connectedOwners');
      
      if (io && connectedOwners) {
        const ownerSocketId = connectedOwners.get(hostelData.owner._id.toString());
        
        const notificationData = {
          type: 'NEW_BOOKING',
          title: '🎉 New Booking Received!',
          message: `${user.name} booked Room ${roomDoc.roomNumber}, Bed ${bedInfo.bedNumber}`,
          bookingId: booking[0]._id.toString(),
          tenantId: tenant._id.toString(),
          tenantName: user.name,
          tenantPhone: user.phone,
          tenantEmail: user.email,
          isNewTenant: isNewTenant,
          roomNumber: roomDoc.roomNumber,
          bedNumber: bedInfo.bedNumber,
          amount: totalAmount,
          rentAmount: monthlyRent,
          securityDeposit: securityDeposit,
          durationMonths: durationMonths,
          checkInDate: checkInDate,
          timestamp: new Date().toISOString()
        };

        // Emit to owner's personal socket if online
        if (ownerSocketId) {
          io.to(ownerSocketId).emit('new_booking', notificationData);
         
        }

        // Also emit to owner's room (for multiple devices)
        io.to(`owner_${hostelData.owner._id}`).emit('new_booking', notificationData);
        
        // Broadcast to hostel room (for all connected owner devices)
        io.to(`hostel_${hostel}`).emit('new_booking', notificationData);
      }
    } catch (socketError) {
      console.error('Socket notification error (non-critical):', socketError);
      // Don't fail the booking if socket fails
    }


    // Populate and return
    const populatedBooking = await Booking.findById(booking[0]._id)
      .populate('hostel', 'name address')
      .populate('room', 'roomNumber')
      .populate('student', 'name phone roomNumber bedNumber')
      .populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully. Awaiting owner confirmation.',
      data: {
        booking: populatedBooking,
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          phone: tenant.phone,
          roomNumber: tenant.roomNumber,
          bedNumber: tenant.bedNumber,
          isNew: isNewTenant
        },
        notificationSent: true
      }
    });

  }  catch (error) {
     if (session.inTransaction()) {
    await session.abortTransaction();
  }

    console.error('Create booking error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
exports.updateBooking = async (req, res) => {
  try {
    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const isOwner = await Property.exists({ _id: booking.hostel, owner: req.user.id });
    const isAdmin = req.user.role === 'admin';
    const isUser = booking.user.toString() === req.user.id;

    if (isUser && !isAdmin && !isOwner) {
      if (booking.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify booking after confirmation'
        });
      }
      const allowedUpdates = ['emergencyContact', 'documents', 'checkInDate'];
      const updates = Object.keys(req.body);
      const isValidOperation = updates.every(update => allowedUpdates.includes(update));
      
      if (!isValidOperation) {
        return res.status(400).json({
          success: false,
          message: 'Invalid updates for user role'
        });
      }
    }

    if (['checkedIn', 'checkedOut', 'completed'].includes(booking.status)) {
      const protectedFields = ['hostel', 'room', 'bed', 'checkInDate', 'checkOutDate', 'user'];
      const attemptedChanges = Object.keys(req.body).filter(key => protectedFields.includes(key));
      
      if (attemptedChanges.length > 0 && !isAdmin) {
        return res.status(400).json({
          success: false,
          message: `Cannot modify ${attemptedChanges.join(', ')} after check-in`
        });
      }
    }

    booking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('user', 'name email')
    .populate('hostel', 'name')
    .populate('room', 'roomNumber')
    .populate('student', 'name phone');

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};


// @desc    Confirm booking (Owner/Admin only)
// @route   PUT /api/bookings/:id/confirm
// @access  Private (Admin/Owner)
exports.confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('hostel', 'name owner')
      .populate('user', 'name email phone')
      .populate('student', 'name phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.status}`
      });
    }

    // Verify ownership
    if (booking.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this booking'
      });
    }

    booking.status = 'checkedIn';
    await booking.save();

    // 🔔 Notify user of confirmation
    try {
      const io = req.app.get('io');
      const connectedUsers = req.app.get('connectedUsers');
      const userSocketId = connectedUsers.get(booking.user._id.toString());
      
      if (userSocketId) {
        io.to(userSocketId).emit('booking_confirmed', {
          type: 'BOOKING_CONFIRMED',
          title: '✅ Booking Confirmed!',
          message: `Your booking for Room ${booking.room} has been confirmed by the owner.`,
          bookingId: booking._id,
          status: 'confirmed'
        });
      }
    } catch (socketError) {
      console.error('Socket error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: booking
    });
  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Check-in student
// @route   PUT /api/bookings/:id/checkin
// @access  Private (Admin/Owner)
exports.checkIn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(req.params.id).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!['confirmed', 'pending'].includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot check-in. Current status: ${booking.status}`
      });
    }

    // Verify authorization
    const hostel = await Property.findById(booking.hostel).session(session);
    if (hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check-in'
      });
    }

    // Update booking
    booking.status = 'checkedIn';
    booking.actualCheckIn = new Date();
    await booking.save({ session });

    // Mark bed as occupied (remove reservation)
    const room = await Room.findById(booking.room).session(session);
    const bed = room.beds.id(booking.bed);
    if (bed) {
      bed.status = 'occupied';
      bed.reservationExpiry = null;
      bed.reservedBy = null;
      await room.save({ session });
    }

    // Update tenant record
    if (booking.student) {
      await Student.findByIdAndUpdate(booking.student, {
        status: 'active',
        checkInDate: new Date()
      }, { session });
    }

    await session.commitTransaction();

    const populatedBooking = await Booking.findById(booking._id)
      .populate('user', 'name email')
      .populate('hostel', 'name')
      .populate('student', 'name phone roomNumber bedNumber');

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: populatedBooking
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};


// @desc    Check-out student
// @route   PUT /api/bookings/:id/checkout
// @access  Private (Admin/Owner)
exports.checkOut = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { refundAmount, damages, notes } = req.body;
    const booking = await Booking.findById(req.params.id).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'checkedIn') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot check-out. Current status: ${booking.status}`
      });
    }

    // Verify authorization
    const hostel = await Property.findById(booking.hostel).session(session);
    if (hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check-out'
      });
    }

    // Update booking
    booking.status = 'checkedOut';
    booking.actualCheckOut = new Date();
    booking.notes = notes || booking.notes;
    await booking.save({ session });

    // Free up the bed
    const room = await Room.findById(booking.room).session(session);
    const bed = room.beds.id(booking.bed);
    if (bed) {
      bed.isOccupied = false;
      bed.currentOccupant = null;
      bed.status = 'available';
      bed.studentId = null;
      bed.studentName = null;
      bed.studentPhone = null;
      bed.studentEmail = null;
      await room.save({ session });
    }

    // Update tenant record
    if (booking.student) {
      await Student.findByIdAndUpdate(booking.student, {
        status: 'checked-out',
        checkOutDate: new Date(),
        room: null,
        roomNumber: null,
        bedId: null,
        bedNumber: null
      }, { session });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Check-out successful',
      data: booking,
      refundDetails: {
        securityDeposit: booking.securityDeposit,
        refundAmount: refundAmount || booking.securityDeposit,
        damages: damages || 0
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  } finally {
    session.endSession();
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
// @access  Private
exports.cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (['checkedIn', 'checkedOut', 'completed', 'cancelled'].includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status: ${booking.status}`
      });
    }

    // Authorization
    const hostel = await Property.findById(booking.hostel).session(session);
    const isOwner = hostel.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isUser = booking.user.toString() === req.user.id;

    if (!isUser && !isAdmin && !isOwner) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Free up the bed if reserved
    const room = await Room.findById(booking.room).session(session);
    const bed = room.beds.id(booking.bed);
    if (bed && bed.reservedBy?.toString() === booking.user.toString()) {
      bed.isOccupied = false;
      bed.status = 'available';
      bed.reservationExpiry = null;
      bed.reservedBy = null;
      bed.studentId = null;
      bed.studentName = null;
      bed.studentPhone = null;
      bed.studentEmail = null;
      await room.save({ session });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason;
    booking.cancelledBy = req.user.id;
    await booking.save({ session });

    await session.commitTransaction();

    // Notify other party
    try {
      const io = req.app.get('io');
      const connectedUsers = req.app.get('connectedUsers');
      const connectedOwners = req.app.get('connectedOwners');

      if (isUser) {
        // User cancelled, notify owner
        const ownerSocketId = connectedOwners.get(hostel.owner.toString());
        if (ownerSocketId) {
          io.to(ownerSocketId).emit('booking_cancelled', {
            type: 'BOOKING_CANCELLED',
            title: '❌ Booking Cancelled',
            message: `Booking for Room ${booking.room} was cancelled by ${req.user.name}`,
            bookingId: booking._id
          });
        }
      } else {
        // Owner/admin cancelled, notify user
        const userSocketId = connectedUsers.get(booking.user.toString());
        if (userSocketId) {
          io.to(userSocketId).emit('booking_cancelled', {
            type: 'BOOKING_CANCELLED',
            title: '❌ Booking Cancelled',
            message: `Your booking was cancelled by ${isOwner ? 'owner' : 'admin'}`,
            bookingId: booking._id,
            reason: reason
          });
        }
      }
    } catch (socketError) {
      console.error('Socket error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  } finally {
    session.endSession();
  }
};


// @desc    Delete booking (Hard delete - Admin only)
// @route   DELETE /api/bookings/:id
// @access  Private (Admin)
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'checkedIn') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active booking. Please check-out first.'
      });
    }

    // Free up bed if reserved
    if (['pending', 'confirmed'].includes(booking.status)) {
      const room = await Room.findById(booking.room);
      if (room) {
        const bed = room.beds.id(booking.bed);
        if (bed && bed.reservedBy?.toString() === booking.user.toString()) {
          bed.isOccupied = false;
          bed.status = 'available';
          bed.reservationExpiry = null;
          bed.reservedBy = null;
          bed.studentId = null;
          bed.studentName = null;
          bed.studentPhone = null;
          bed.studentEmail = null;
          await room.save();
        }
      }
    }

    await booking.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get booking statistics (Admin/Owner)
// @route   GET /api/bookings/stats/overview
// @access  Private (Admin/Owner)
exports.getBookingStats = async (req, res) => {
  try {
    let matchStage = {};
    
    if (req.user.role === 'owner') {
      const hostels = await Property.find({ owner: req.user.id }).select('_id');
      matchStage.hostel = { $in: hostels.map(h => h._id) };
    }

    const stats = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const monthlyStats = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          bookings: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusBreakdown: stats,
        monthlyTrends: monthlyStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};