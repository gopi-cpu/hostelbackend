const jwt = require('jsonwebtoken');
const User = require('../models/authUser');

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  
  return (req, res, next) => {
    console.log(req.user);
    // if (!roles.includes(req.user.role)) {
    //   return res.status(403).json({
    //     success: false,
    //     message: `User role ${req.user.role} is not authorized to access this route`
    //   });
    // }
    next();
  };
};

// Check hostel ownership
exports.checkHostelOwnership = async (req, res, next) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    // Check if user owns the hostel
    if (hostel.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this hostel'
      });
    }

    req.hostel = hostel;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};