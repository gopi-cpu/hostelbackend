const Room = require('../models/roomSchema');
const Hostel = require('../models/hostelschema');

// @desc    Get all beds for a specific room
// @route   GET /api/v1/rooms/:roomId/beds
// @access  Public
exports.getBeds = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)
      .populate('beds.currentOccupant', 'name email phone')
      .populate('hostel', 'name address');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    res.status(200).json({
      success: true,
      count: room.beds.length,
      data: room.beds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single bed details
// @route   GET /api/v1/rooms/:roomId/beds/:bedNumber
// @access  Public
exports.getBed = async (req, res) => {
  try {
    const { roomId, bedNumber } = req.params;

    const room = await Room.findById(roomId)
      .populate('beds.currentOccupant', 'name email phone')
      .populate('hostel', 'name address');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const bed = room.beds.find(b => b.bedNumber === bedNumber);

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Add new bed to existing room
// @route   POST /api/v1/rooms/:roomId/beds
// @access  Private
exports.addBed = async (req, res) => {
  console.log('bed routing')
  try {
    const { roomId } = req.params;
    const { bedNumber, rentAmount, amenities } = req.body;

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    // Check if bed number already exists in this room
    const bedExists = room.beds.some(bed => bed.bedNumber === bedNumber);
    console.log('bedexists',bedExists)
    if (bedExists) {
      return res.status(400).json({
        success: false,
        message: `Bed ${bedNumber} already exists in this room`
      });
    }
  
    
    // Check if adding bed exceeds capacity
    if (room.beds.length >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: `Cannot add more beds. Room capacity is ${room.capacity}`
      });
    }

    // Add new bed
    const newBed = {
      bedNumber,
      rentAmount: rentAmount || room.rentAmount,
      amenities: amenities || [],
      isOccupied: false,
      status: 'available'
    };
     console.log('new bed',newBed)

    room.beds.push(newBed);
    await room.save();

    res.status(201).json({
      success: true,
      message: 'Bed added successfully',
      data: room.beds[room.beds.length - 1]
    });
  } catch (error) {
    console.log('errorr',error)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Update bed details
// @route   PUT /api/v1/rooms/:roomId/beds/:bedNumber
// @access  Private
exports.updateBed = async (req, res) => {
  try {
    const { roomId, bedNumber } = req.params;
    const { rentAmount, amenities, status } = req.body;

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);

    if (bedIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    // Prevent status change if bed is occupied (unless vacating)
    if (room.beds[bedIndex].isOccupied && status && status !== 'occupied') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status of occupied bed. Please vacate first.'
      });
    }

    // Update allowed fields
    if (rentAmount !== undefined) room.beds[bedIndex].rentAmount = rentAmount;
    if (amenities !== undefined) room.beds[bedIndex].amenities = amenities;
    if (status !== undefined) room.beds[bedIndex].status = status;

    await room.save();

    res.status(200).json({
      success: true,
      message: 'Bed updated successfully',
      data: room.beds[bedIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Delete bed from room
// @route   DELETE /api/v1/rooms/:roomId/beds/:bedNumber
// @access  Private
exports.deleteBed = async (req, res) => {
  try {
    const { roomId, bedNumber } = req.params;

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);

    if (bedIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    // Check if bed is occupied
    if (room.beds[bedIndex].isOccupied) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete occupied bed. Please vacate first.'
      });
    }

    // Remove bed
    room.beds.splice(bedIndex, 1);
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Bed deleted successfully',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Set bed maintenance status
// @route   PUT /api/v1/rooms/:roomId/beds/:bedNumber/maintenance
// @access  Private
exports.setBedMaintenance = async (req, res) => {
  try {
    const { roomId, bedNumber } = req.params;
    const { reason } = req.body;

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);

    if (bedIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    if (room.beds[bedIndex].isOccupied) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set maintenance on occupied bed'
      });
    }

    room.beds[bedIndex].status = 'maintenance';
    await room.save();

    res.status(200).json({
      success: true,
      message: `Bed ${bedNumber} is now under maintenance`,
      data: room.beds[bedIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Reserve bed for student
// @route   PUT /api/v1/rooms/:roomId/beds/:bedNumber/reserve
// @access  Private
exports.reserveBed = async (req, res) => {
  try {
    const { roomId, bedNumber } = req.params;
    const { userId, reservationExpiry } = req.body;

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);

    if (bedIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    if (room.beds[bedIndex].isOccupied) {
      return res.status(400).json({
        success: false,
        message: 'Bed is already occupied'
      });
    }

    if (room.beds[bedIndex].status === 'maintenance') {
      return res.status(400).json({
        success: false,
        message: 'Bed is under maintenance'
      });
    }

    if (room.beds[bedIndex].status === 'reserved') {
      return res.status(400).json({
        success: false,
        message: 'Bed is already reserved'
      });
    }

    room.beds[bedIndex].status = 'reserved';
    room.beds[bedIndex].currentOccupant = userId; // Temporarily store reserved user
    // Optional: Add reservationExpiry to schema if needed
    
    await room.save();

    res.status(200).json({
      success: true,
      message: `Bed ${bedNumber} reserved successfully`,
      data: room.beds[bedIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Cancel bed reservation
// @route   PUT /api/v1/rooms/:roomId/beds/:bedNumber/cancel-reservation
// @access  Private
exports.cancelReservation = async (req, res) => {
  try {
    const { roomId, bedNumber } = req.params;

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);

    if (bedIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    if (room.beds[bedIndex].status !== 'reserved') {
      return res.status(400).json({
        success: false,
        message: 'Bed is not reserved'
      });
    }

    room.beds[bedIndex].status = 'available';
    room.beds[bedIndex].currentOccupant = null;
    
    await room.save();

    res.status(200).json({
      success: true,
      message: `Reservation cancelled for bed ${bedNumber}`,
      data: room.beds[bedIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Swap students between two beds
// @route   PUT /api/v1/rooms/:roomId/beds/swap
// @access  Private
exports.swapBeds = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { bedNumber1, bedNumber2 } = req.body;

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bed1Index = room.beds.findIndex(bed => bed.bedNumber === bedNumber1);
    const bed2Index = room.beds.findIndex(bed => bed.bedNumber === bedNumber2);

    if (bed1Index === -1 || bed2Index === -1) {
      return res.status(404).json({
        success: false,
        message: 'One or both beds not found'
      });
    }

    // Swap occupants
    const tempOccupant = room.beds[bed1Index].currentOccupant;
    const tempIsOccupied = room.beds[bed1Index].isOccupied;
    const tempStatus = room.beds[bed1Index].status;

    room.beds[bed1Index].currentOccupant = room.beds[bed2Index].currentOccupant;
    room.beds[bed1Index].isOccupied = room.beds[bed2Index].isOccupied;
    room.beds[bed1Index].status = room.beds[bed2Index].status;

    room.beds[bed2Index].currentOccupant = tempOccupant;
    room.beds[bed2Index].isOccupied = tempIsOccupied;
    room.beds[bed2Index].status = tempStatus;

    await room.save();

    res.status(200).json({
      success: true,
      message: 'Beds swapped successfully',
      data: {
        [bedNumber1]: room.beds[bed1Index],
        [bedNumber2]: room.beds[bed2Index]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get available beds across hostel
// @route   GET /api/v1/hostels/:hostelId/beds/available
// @access  Public
exports.getAvailableBeds = async (req, res) => {
  try {
    const { hostelId } = req.params;
    const { floor, roomType, minRent, maxRent } = req.query;

    const matchStage = {
      hostel: mongoose.Types.ObjectId(hostelId),
      'beds.status': 'available',
      'beds.isOccupied': false
    };

    if (floor) matchStage.floor = parseInt(floor);
    if (roomType) matchStage.roomType = roomType;

    const rooms = await Room.aggregate([
      { $match: matchStage },
      { $unwind: '$beds' },
      { $match: { 'beds.status': 'available', 'beds.isOccupied': false } },
      {
        $match: {
          ...(minRent && { 'beds.rentAmount': { $gte: parseInt(minRent) } }),
          ...(maxRent && { 'beds.rentAmount': { $lte: parseInt(maxRent) } })
        }
      },
      {
        $project: {
          roomNumber: 1,
          floor: 1,
          roomType: 1,
          bed: '$beds',
          amenities: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Bulk update bed statuses
// @route   PUT /api/v1/rooms/:roomId/beds/bulk-update
// @access  Private
exports.bulkUpdateBeds = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { bedUpdates } = req.body; // Array of { bedNumber, status, rentAmount }

    const room = await Room.findById(roomId).populate('hostel');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const updatedBeds = [];
    const errors = [];

    bedUpdates.forEach(update => {
      const bedIndex = room.beds.findIndex(bed => bed.bedNumber === update.bedNumber);
      
      if (bedIndex === -1) {
        errors.push(`Bed ${update.bedNumber} not found`);
        return;
      }

      if (room.beds[bedIndex].isOccupied && update.status && update.status !== 'occupied') {
        errors.push(`Cannot update occupied bed ${update.bedNumber}`);
        return;
      }

      if (update.rentAmount !== undefined) {
        room.beds[bedIndex].rentAmount = update.rentAmount;
      }
      if (update.status !== undefined) {
        room.beds[bedIndex].status = update.status;
      }
      if (update.amenities !== undefined) {
        room.beds[bedIndex].amenities = update.amenities;
      }

      updatedBeds.push(room.beds[bedIndex]);
    });

    await room.save();

    res.status(200).json({
      success: true,
      message: `Updated ${updatedBeds.length} beds`,
      errors: errors.length > 0 ? errors : undefined,
      data: updatedBeds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};



exports.assignBed = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { roomId, bedNumber } = req.params;
    const { 
      userId, 
      studentId, 
      studentName, 
      studentPhone, 
      studentEmail,
      checkInDate 
    } = req.body;

    const room = await Room.findById(roomId)
      .populate('hostel')
      .session(session);

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);

    if (bedIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    const bed = room.beds[bedIndex];

    // Check if bed is available
    if (bed.isOccupied) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Bed is already occupied'
      });
    }

    if (bed.status === 'maintenance') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Bed is under maintenance'
      });
    }

    // Assign student to bed
    bed.isOccupied = true;
    bed.status = 'occupied';
    bed.currentOccupant = userId || null;
    bed.studentId = studentId;
    bed.studentName = studentName;
    bed.studentPhone = studentPhone;
    bed.studentEmail = studentEmail;
    bed.checkInDate = checkInDate || new Date();

    await room.save({ session });

    // Update room occupancy status
    const occupiedBeds = room.beds.filter(b => b.isOccupied).length;
    if (occupiedBeds === room.beds.length) {
      room.status = 'occupied';
    } else if (occupiedBeds > 0) {
      room.status = 'partially-occupied'; // Add this status if needed
    }
    await room.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Bed ${bedNumber} assigned to ${studentName}`,
      data: bed
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Assign bed error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};



exports.vacateBed = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { roomId, bedNumber } = req.params;

    const room = await Room.findById(roomId)
      .populate('hostel')
      .session(session);

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check ownership
    if (room.hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this room'
      });
    }

    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);

    if (bedIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    const bed = room.beds[bedIndex];

    if (!bed.isOccupied) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Bed is already vacant'
      });
    }

    // Store previous occupant info for response
    const previousOccupant = {
      studentId: bed.studentId,
      studentName: bed.studentName
    };

    // Clear bed assignment
    bed.isOccupied = false;
    bed.status = 'available';
    bed.currentOccupant = null;
    bed.studentId = null;
    bed.studentName = null;
    bed.studentPhone = null;
    bed.studentEmail = null;
    bed.checkInDate = null;

    await room.save({ session });

    // Update room status
    const occupiedBeds = room.beds.filter(b => b.isOccupied).length;
    if (occupiedBeds === 0) {
      room.status = 'vacant';
    } else {
      room.status = 'partially-occupied';
    }
    await room.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Bed ${bedNumber} vacated. Previous occupant: ${previousOccupant.studentName || 'Unknown'}`,
      data: bed,
      previousOccupant
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Vacate bed error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  } finally {
    session.endSession();
  }
};


exports.getBedHistory = async (req, res) => {
  try {
    const { roomId, bedNumber } = req.params;

    // This would require a separate History model
    // For now, return current bed info
    const room = await Room.findById(roomId)
      .populate('beds.studentId', 'name email phone')
      .populate('beds.currentOccupant', 'name email');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const bed = room.beds.find(b => b.bedNumber === bedNumber);

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};