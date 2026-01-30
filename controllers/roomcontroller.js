const Room = require('../models/roomSchema');
const Hostel = require('../models/hostelschema');

// @desc    Get all rooms for a hostel
// @route   GET /api/v1/hostels/:hostelId/rooms
// @access  Public
exports.getRooms = async (req, res, next) => {
  try {
    const { hostelId } = req.params;

    console.log(hostelId)
    const rooms = await Room.find({ hostel: hostelId })
      .populate('beds.currentOccupant', 'name email phone');
    
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

// @desc    Get single room
// @route   GET /api/v1/rooms/:id
// @access  Public
exports.getRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('hostel', 'name address contact')
      .populate('beds.currentOccupant', 'name email phone');
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create room
// @route   POST /api/v1/hostels/:hostelId/rooms
// @access  Private
exports.createRoom = async (req, res) => {
  try {
    const { hostelId, floor, roomNumber, beds, ...roomData } = req.body;

    console.log("Rooms API called:", hostelId, floor, roomNumber, beds);
    console.log('hostelid',hostelId)
    // 1️⃣ Validate hostel
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: "Hostel not found",
      });
    }

    // 2️⃣ Normalize beds (IMPORTANT FIX)
    let normalizedBeds = [];

    if (Array.isArray(beds)) {
      normalizedBeds = beds;
    } else if (beds && typeof beds === "object") {
      normalizedBeds = [beds];
    }

    if (!normalizedBeds.length) {
      return res.status(400).json({
        success: false,
        message: "At least one bed is required",
      });
    }

    // 3️⃣ Check if room exists
    let existingRoom = await Room.findOne({
      hostel: hostelId,
      floor,
      roomNumber,
    });

    // ===============================
    // 🟢 CASE 1: ROOM ALREADY EXISTS
    // ===============================
    if (existingRoom) {
      // Extract existing bed numbers
      const existingBedNumbers = existingRoom.beds.map(
        (bed) => bed.bedNumber
      );

      // Check for duplicate beds
      const duplicateBeds = normalizedBeds.filter((bed) =>
        existingBedNumbers.includes(bed.bedNumber)
      );

      if (duplicateBeds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Bed(s) ${duplicateBeds
            .map((b) => b.bedNumber)
            .join(", ")} already exist in room ${roomNumber}`,
        });
      }

      // Add new beds
      existingRoom.beds.push(...normalizedBeds);
      await existingRoom.save();

      return res.status(200).json({
        success: true,
        message: "Beds added to existing room",
        data: existingRoom,
      });
    }

    // ===============================
    // 🟢 CASE 2: NEW ROOM
    // ===============================
    const newRoom = await Room.create({
      hostel: hostelId,
      floor,
      roomNumber,
      beds: normalizedBeds,
      ...roomData,
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: newRoom,
    });
  } catch (error) {
    console.error("Create room error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (val) => val.message
      );

      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



// @desc    Update room
// @route   PUT /api/v1/rooms/:id
// @access  Private
exports.updateRoom = async (req, res, next) => {
  try {
    let room = await Room.findById(req.params.id).populate('hostel');
    
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
        message: 'Not authorized to update this room'
      });
    }
    
    room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    res.status(200).json({
      success: true,
      data: room
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

// @desc    Delete room
// @route   DELETE /api/v1/rooms/:id
// @access  Private
exports.deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('hostel');
    
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
        message: 'Not authorized to delete this room'
      });
    }
    
    await room.deleteOne();
    
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

// @desc    Assign student to bed
// @route   PUT /api/v1/rooms/:id/beds/:bedNumber/assign
// @access  Private
exports.assignBed = async (req, res, next) => {
  try {
    const { id, bedNumber } = req.params;
    const { userId, checkInDate } = req.body;
    
    const room = await Room.findById(id).populate('hostel');
    
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
    
    // Find the bed
    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);
    
    if (bedIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }
    
    // Check if bed is available
    if (room.beds[bedIndex].isOccupied) {
      return res.status(400).json({
        success: false,
        message: 'Bed is already occupied'
      });
    }
    
    // Update bed
    room.beds[bedIndex].isOccupied = true;
    room.beds[bedIndex].currentOccupant = userId;
    room.beds[bedIndex].status = 'occupied';
    
    await room.save();
    
    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Vacate bed
// @route   PUT /api/v1/rooms/:id/beds/:bedNumber/vacate
// @access  Private
exports.vacateBed = async (req, res, next) => {
  try {
    const { id, bedNumber } = req.params;
    
    const room = await Room.findById(id).populate('hostel');
    
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
    
    // Find the bed
    const bedIndex = room.beds.findIndex(bed => bed.bedNumber === bedNumber);
    
    if (bedIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }
    
    // Update bed
    room.beds[bedIndex].isOccupied = false;
    room.beds[bedIndex].currentOccupant = null;
    room.beds[bedIndex].status = 'available';
    
    await room.save();
    
    res.status(200).json({
      success: true,
      data: room
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};