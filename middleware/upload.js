const multer = require('multer');
const path = require('path');

// ==============================
// 📂 Storage Configuration
// ==============================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/paymentProofs/'); // folder path
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

// ==============================
// 🛡️ File Filter (only images)
// ==============================
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// ==============================
// 🚀 Upload Middleware
// ==============================
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

module.exports = upload;