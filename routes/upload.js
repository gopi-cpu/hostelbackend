const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Configure AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Configure multer for S3 upload
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { 
        fieldName: file.fieldname,
        uploadedBy: req.user?._id?.toString() || 'anonymous',
      });
    },
    key: function (req, file, cb) {
      const uniqueName = `hostel-images/${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// @route   POST /api/upload/image
// @desc    Upload single image to S3
// @access  Public/Private (add auth middleware if needed)
router.post('/image', upload.single('image'), (req, res) => {
  try {
    console.log('image upload')
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: req.file.location,
        key: req.file.key,
        originalName: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message,
    });
  }
});

// @route   POST /api/upload/images
// @desc    Upload multiple images to S3
// @access  Public/Private
router.post('/images', upload.array('images', 10), (req, res) => {
  try {
    console.log('images upload api ')
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image files provided',
      });
    }

    const uploadedUrls = req.files.map(file => ({
      url: file.location,
      key: file.key,
      originalName: file.originalname,
      size: file.size,
    }));

    res.status(200).json({
      success: true,
      message: `${req.files.length} images uploaded successfully`,
      data: {
        urls: uploadedUrls.map(u => u.url),
        files: uploadedUrls,
        count: req.files.length,
      },
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      error: error.message,
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files.',
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: error.message || 'Upload failed',
  });
});

module.exports = router;