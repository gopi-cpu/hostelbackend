const User = require("../models/authUser");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Booking = require('../models/bookingschema')
const Hostel = require('../models/hostelschema')
const Room = require('../models/roomSchema')
const Payment = require('../models/paymentSchema')
const Notification = require('../models/notificationschema')
const Maintenance = require('../models/Maintenance')

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret123", {
    expiresIn: "30d",
  });
};

// @desc Register
exports.registerUser = async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const user = await User.create({ name, email, password, phone });

    res.status(201).json({
      message: "User registered successfully",
      userId: user._id,
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc Verify Email

exports.verifyUser = async (req, res) => {
  try {
    const { token } = req.params;
    console.log(token)

    // ✅ Decode token to get user id
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");
    } catch (err) {
      console.log(err)
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const userId = decoded.id; // since you signed { id } in your JWT

    // ✅ Find user by _id
    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User already verified" });
    }

    // ✅ Update verification status
    user.isVerified = true;
    await user.save();

    res.json({ message: "Account verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
 console.log(email,password)
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.isVerified) return res.status(403).json({ message: "Verify your account first" });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc Get Profile
exports.getProfile = async (req, res) => {
  try {
    // ✅ Get token from header (Authorization: Bearer <token>)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify and decode the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // ✅ Get user by ID from decoded token
    const user = await User.findById(decoded.id).select("-password"); // hide password
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    res.json({
      message: "Password reset token generated",
      resetToken, // (send via email in real app)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Add Favorite
exports.addFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { hostelId } = req.body;
    if (!user.favorites.includes(hostelId)) {
      user.favorites.push(hostelId);
      await user.save();
    }

    res.json(`favourites added successfully ${user.favorites}`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Remove Favorite
exports.removeFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { hostelId } = req.body;
    user.favorites = user.favorites.filter((id) => id.toString() !== hostelId);
    await user.save();

    res.json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getUserDashboard = async (req, res, next) => {
  try {
    // Get user's current booking (active booking)
    const currentBooking = await Booking.findOne({
      user: req.user.id,
      status: { $in: ['confirmed', 'checkedIn'] }
    }).sort({ createdAt: -1 });

    if (!currentBooking) {
      return res.status(200).json({
        success: true,
        data: {
          user: {
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            profileImage: req.user.profileImage
          },
          room: null,
          hostel: null,
          upcomingPayment: null,
          recentPayments: [],
          stats: {
            unreadNotifications: 0,
            pendingMaintenance: 0
          },
          message: 'No active booking found'
        }
      });
    }

    // Manually populate hostel and room
    const hostelData = await Hostel.findById(currentBooking.hostel).select('name address images');
    const roomData = await Room.findById(currentBooking.room).select('roomNumber roomType rent beds');

    // Get upcoming payment for the current booking
    const upcomingPayment = await Payment.findOne({
      booking: currentBooking._id,
      paymentStatus: 'pending'
    }).sort({ dueDate: 1 });

    // Get recent payments for the current booking
    const recentPayments = await Payment.find({
      booking: currentBooking._id,
      paymentStatus: 'paid'
    })
      .sort({ paidDate: -1 })
      .limit(2);

    // Get unread notifications count
    const unreadNotifications = await Notification.countDocuments({
      user: req.user.id,
      isRead: false
    });

    // Get pending maintenance requests for the current booking/hostel
    const pendingMaintenance = await Maintenance.countDocuments({
      raisedBy: req.user.id,
      status: 'pending',
      hostel: currentBooking.hostel
    });

    let bookedBed = null;
    if (currentBooking.bed) {
      bookedBed = roomData?.beds.find(b => b._id.toString() === currentBooking.bed.toString());
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone,
          profileImage: req.user.profileImage
        },
        room: roomData ? {
          number: roomData.roomNumber,
          type: roomData.roomType,
          rent: roomData.rent,
          bed: bookedBed ? {
            bedNumber: bookedBed.bedNumber,
            rentAmount: bookedBed.rentAmount,
            status: bookedBed.status
              } : null
            } : null,
        hostel: hostelData ? {
          name: hostelData.name,
          address: hostelData.address,
          images: hostelData.images
        } : null,
        booking: {
          id: currentBooking._id,
          checkInDate: currentBooking.checkInDate,
          checkOutDate: currentBooking.checkOutDate,
          status: currentBooking.status,
          rentAmount: currentBooking.rentAmount
        },
        upcomingPayment: upcomingPayment ? {
          id: upcomingPayment._id,
          amount: upcomingPayment.totalAmount,
          dueDate: upcomingPayment.dueDate,
          description: `Rent for ${upcomingPayment.month}`
        } : null,
        recentPayments: recentPayments.map(payment => ({
          id: payment._id,
          amount: payment.totalAmount,
          paidDate: payment.paidDate,
          description: `Rent for ${payment.month}`,
          status: payment.paymentStatus
        })),
        stats: {
          unreadNotifications,
          pendingMaintenance
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
