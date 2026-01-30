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
} = require("../controllers//authControllers");
const { protect } = require("../middleware/authMiddleware");

// Auth
router.post("/register", registerUser);
router.get("/verify/:token", verifyUser); 
router.post("/login", loginUser);

// Profile
router.get("/profile", protect, getProfile);
router.get('/profile/hostel',protect,getProfileWithHostels)

// Password Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Favorites
router.post("/favorites", protect, addFavorite);
router.delete("/favorites", protect, removeFavorite);
router.get('/dashboard', protect,getUserDashboard);

module.exports = router;
