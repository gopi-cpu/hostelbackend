// middleware/roomLimits.js
const RoomLimitError = require('../utils/roomLimitError');

const checkRoomLimits = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming you have auth middleware
    const User = require('../models/User');
    const Hostel = require('../models/Hostel');
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const limits = user.getMembershipLimits();
    const { rooms } = req.body;
    
    // Calculate total rooms being added
    let totalRooms = 0;
    if (rooms && Array.isArray(rooms)) {
      totalRooms = rooms.reduce((acc, room) => acc + (room.count || 0), 0);
    }
    
    // Check if this is a new property or existing one
    const propertyId = req.params.id || req.body.propertyId;
    let existingRooms = 0;
    
    if (propertyId) {
      const existingProperty = await Hostel.findById(propertyId);
      if (existingProperty && existingProperty.rooms) {
        existingRooms = existingProperty.rooms.reduce((acc, room) => acc + (room.count || 0), 0);
      }
    }
    
    const newTotal = existingRooms + totalRooms;
    
    if (newTotal > limits.maxRoomsPerProperty) {
      return res.status(403).json({
        success: false,
        message: `Room limit exceeded. Your ${user.membership.type} plan allows maximum ${limits.maxRoomsPerProperty} rooms per property. Current: ${existingRooms}, Requested: ${totalRooms}`,
        limit: limits.maxRoomsPerProperty,
        current: existingRooms,
        requested: totalRooms,
        membershipType: user.membership.type,
        upgradeRequired: true
      });
    }
    
    // Attach limits to request for use in controller
    req.membershipLimits = limits;
    req.userMembership = user.membership;
    
    next();
  } catch (error) {
    console.error('Room limit check error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = checkRoomLimits;