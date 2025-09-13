const Booking = require('../models/bookingschema');
const Room = require('../models/roomSchema');
const Hostel = require('../models/hostelschema');

// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @access  Private
exports.getBookings = async (req, res, next) => {
  try {
    let query;
    
    // Admin can see all bookings, users can only see their own
    if (req.user.role === 'admin') {
      query = Booking.find().populate('user hostel room');
    } else {
      query = Booking.find({ user: req.user.id }).populate('hostel room');
    }
    
    const bookings = await query;
    
    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Private
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('hostel', 'name address contact')
      .populate('room', 'roomNumber floor');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Make sure user is booking owner or admin
    if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
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
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create booking
// @route   POST /api/v1/bookings
// @access  Private
exports.createBooking = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id;

    const { hostel, room, bed, checkInDate, duration } = req.body;
    
    // Check if room and bed are available
    const roomDoc = await Room.findById(room);
    if (!roomDoc) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    const bedInfo = roomDoc.beds.find(b => b.bedNumber === bed);
    if (!bedInfo) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }
 
    if (bedInfo.isOccupied) {
      return res.status(400).json({
        success: false,
        message: 'Bed is already occupied'
      });
    }
    
    // Calculate check-out date
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setMonth(checkOutDate.getMonth() + parseInt(duration));
    
    // Calculate total amount
    const totalAmount = bedInfo.rentAmount * parseInt(duration);
    
    // Create booking
    const booking = await Booking.create({
      ...req.body,
      checkOutDate,
      rentAmount: bedInfo.rentAmount,
      securityDeposit: bedInfo.rentAmount, // Typically one month's rent as security
      totalAmount
    });
    
    // Update bed status
    bedInfo.isOccupied = true;
    bedInfo.currentOccupant = req.user.id;
    bedInfo.status = 'occupied';
    await roomDoc.save();
    
    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    } else {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }
};

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
// @access  Private
exports.updateBooking = async (req, res, next) => {
  try {
    let booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }
    
    booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: booking
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

// @desc    Delete booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private
exports.deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Make sure user is booking owner or admin
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this booking'
      });
    }

    // Free up the bed
    const room = await Room.findById(booking.room);
    if (room) {
      const bedInfo = room.beds.find(b => b.bedNumber === booking.bed);
      if (bedInfo) {
        bedInfo.isOccupied = false;
        bedInfo.currentOccupant = null;
        bedInfo.status = 'available';
        await room.save();
      }
    }

    await booking.deleteOne();

    res.status(200).json({
      success: true,
      message: `Booking deleted and bed ${booking.bed} is now available`,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Check-in student
// @route   PUT /api/v1/bookings/:id/checkin
// @access  Private
exports.checkIn = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
  
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Only hostel owner or admin can check-in
    const hostel = await Hostel.findById(booking.hostel);

    if (hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check-in'
      });
    }
    
    booking.status = 'checkedIn';
    await booking.save();
    
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Check-out student
// @route   PUT /api/v1/bookings/:id/checkout
// @access  Private
exports.checkOut = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Only hostel owner or admin can check-out
    const hostel = await Hostel.findById(booking.hostel);
    if (hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to check-out'
      });
    }
    
    booking.status = 'checkedOut';
    booking.checkOutDate = new Date();
    await booking.save();
    
    // Free up the bed
    const room = await Room.findById(booking.room);
    if (room) {
      const bedIndex = room.beds.findIndex(b => b.bedNumber === booking.bed);
      if (bedIndex !== -1) {
        room.beds[bedIndex].isOccupied = false;
        room.beds[bedIndex].currentOccupant = null;
        room.beds[bedIndex].status = 'available';
        await room.save();
      }
    }
    
    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};