const Hostel = require('../models/hostelschema');
// const { uploadImage, deleteImage } = require('../utils/uploadImage');
const { getCoordinates , geocoder} = require('../utils/geocoder');
const Review = require('../models/reviewschema');
// @desc    Get all hostels
// @route   GET /api/v1/hostels
// @access  Public
exports.getHostels = async (req, res, next) => {
  console.log("Get hostels called");
  try {
    // Copy req.query
    const reqQuery = { ...req.query };
    
    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];
    removeFields.forEach(param => delete reqQuery[param]);
    
    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
    // Finding resource
    let query = Hostel.find(JSON.parse(queryStr)).populate('owner', 'name email phone');
    
    // Select fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }
    
    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Hostel.countDocuments(JSON.parse(queryStr));
    
    query = query.skip(startIndex).limit(limit);
    
    // Executing query
    const hostels = await query;
    
    // Pagination result
    const pagination = {};
    
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    res.status(200).json({
      success: true,
      count: hostels.length,
      pagination,
      data: hostels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single hostel
// @route   GET /api/v1/hostels/:id
// @access  Public
exports.getHostel = async (req, res, next) => {
  try {
    const hostel = await Hostel.findById(req.params.id)
      .populate('owner', 'name email phone')
      .populate({
        path: 'reviews',
        populate: {
          path: 'user',
          select: 'name profileImage'
        }
      });
    
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: hostel
    });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create hostel
// @route   POST /api/v1/hostels
// @access  Private
exports.createHostel = async (req, res, next) => {
  try {
    // Add owner to req.body
    console.log("User ID:", req.body.id);
    // req.body.owner = req.user.id;
     
  
    // Get coordinates from address
    const fullAddress = `${req.body.address.street}, ${req.body.address.city}, ${req.body.address.state}, ${req.body.address.pincode}, ${req.body.address.country}`;
    
    try {
      const coordinates = await getCoordinates(fullAddress);
      req.body.address.coordinates = coordinates;
    } catch (error) {
      console.log('Geocoding error:', error.message);
    }
    
    const hostel = await Hostel.create(req.body);
    
    res.status(201).json({
      success: true,
      data: hostel
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    } else {
      console.log('Error:', error); 
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }
};

// @desc    Update hostel
// @route   PUT /api/v1/hostels/:id
// @access  Private
exports.updateHostel = async (req, res, next) => {
 
  try {
    let hostel = await Hostel.findById(req.params.id);
     
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }
      console.log("Hostel found:", hostel);
    // Check ownership
    if (hostel.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this hostel'
      });
    }
  
    // If address is being updated, get new coordinates
    if (req.body.address) {
      console.log("Address is being updated");
      const fullAddress = `${req.body.address.street || hostel.address.street}, ${req.body.address.city || hostel.address.city}, ${req.body.address.state || hostel.address.state}, ${req.body.address.pincode || hostel.address.pincode}, ${req.body.address.country || hostel.address.country}`;
      
      try {
        const coordinates = await getCoordinates(fullAddress);
        req.body.address.coordinates = coordinates;
      } catch (error) {
        console.log('Geocoding error:', error.message);
      }
    }
    
    hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    console.log('mklx',hostel);
    res.status(200).json({
      success: true,
      data: hostel
    });
  } catch (error) {
    console.log('Error:', error);
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

// @desc    Delete hostel
// @route   DELETE /api/v1/hostels/:id
// @access  Private
exports.deleteHostel = async (req, res, next) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }
    
    // Check ownership
    if (hostel.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this hostel'
      });
    }
    
    // Delete associated images from Cloudinary
    if (hostel.images && hostel.images.length > 0) {
      for (const image of hostel.images) {
        const publicId = image.url.split('/').pop().split('.')[0];
        await deleteImage(`hostels/${publicId}`);
      }
    }
    
    await hostel.deleteOne();
    
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

// @desc    Upload images for hostel
// @route   PUT /api/v1/hostels/:id/images
// @access  Private
// exports.uploadHostelImages = async (req, res, next) => {
//   try {
//     const hostel = await Hostel.findById(req.params.id);
    
//     if (!hostel) {
//       return res.status(404).json({
//         success: false,
//         message: 'Hostel not found'
//       });
//     }
    
//     // Check ownership
//     if (hostel.owner.toString() !== req.user.id) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to update this hostel'
//       });
//     }
    
//     if (!req.files) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please upload an image'
//       });
//     }
    
//     const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
//     const uploadedImages = [];
    
//     // Upload images
//     for (const file of imageFiles) {
//       const result = await uploadImage(file.tempFilePath, 'hostels');
      
//       uploadedImages.push({
//         url: result.secure_url,
//         caption: file.name,
//         isPrimary: false
//       });
//     }
    
//     // Add new images to hostel
//     hostel.images = [...hostel.images, ...uploadedImages];
//     await hostel.save();
    
//     res.status(200).json({
//       success: true,
//       data: hostel.images
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server Error'
//     });
//   }
// };

// @desc    Delete hostel image
// @route   DELETE /api/v1/hostels/:id/images/:imageId
// @access  Private
exports.deleteHostelImage = async (req, res, next) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }
    
    // Check ownership
    if (hostel.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this hostel'
      });
    }
    
    const imageIndex = hostel.images.findIndex(
      image => image._id.toString() === req.params.imageId
    );
    
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    const imageToDelete = hostel.images[imageIndex];
    
    // Delete image from Cloudinary
    const publicId = imageToDelete.url.split('/').pop().split('.')[0];
    await deleteImage(`hostels/${publicId}`);
    
    // Remove image from array
    hostel.images.splice(imageIndex, 1);
    await hostel.save();
    
    res.status(200).json({
      success: true,
      data: hostel.images
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get hostels within radius
// @route   GET /api/v1/hostels/radius/:zipcode/:distance
// @access  Public
exports.getHostelsInRadius = async (req, res, next) => {
  try {
    const { zipcode, distance } = req.params;
    
    // Get lat/lng from geocoder
    const loc = await geocoder.geocode(zipcode);
    const lat = loc[0].latitude;
    const lng = loc[0].longitude;
    
    // Calc radius using radians
    // Divide distance by radius of Earth (3,963 mi / 6,378 km)
    const radius = distance / 3963;
    
    const hostels = await Hostel.find({
      'address.coordinates': {
        $geoWithin: { $centerSphere: [[lng, lat], radius] }
      }
    });
    
    res.status(200).json({
      success: true,
      count: hostels.length,
      data: hostels
    });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};