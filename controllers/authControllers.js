const User = require("../models/authUser");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

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
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const verificationToken = crypto.randomBytes(20).toString("hex");

    const user = await User.create({ name, email, password, phone, verificationToken });

    res.status(201).json({
      message: "User registered successfully. Verify your account.",
      userId: user._id,
      verificationToken: user.verificationToken, // (send via email in real app)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Verify Email
exports.verifyUser = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });

    if (!user) return res.status(400).json({ message: "Invalid token" });

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({ message: "Account verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

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
  res.json(req.user);
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
