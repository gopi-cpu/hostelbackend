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
  getUserDashboard
} = require("../controllers//authControllers");
const { protect } = require("../middleware/authMiddleware");

// Auth
router.post("/register", registerUser);
router.get("/verify/:token", verifyUser); 
router.post("/login", loginUser);

// Profile
router.get("/profile", protect, getProfile);

// Password Reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Favorites
router.post("/favorites", protect, addFavorite);
router.delete("/favorites", protect, removeFavorite);
router.get('/dashboard', protect,getUserDashboard);

module.exports = router;
