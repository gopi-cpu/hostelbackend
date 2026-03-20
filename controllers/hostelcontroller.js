// const Hostel = require('../models/hostelschema');
// // const { uploadImage, deleteImage } = require('../utils/uploadImage');
// const { getCoordinates , geocoder} = require('../utils/geocoder');
// const Review = require('../models/reviewschema');
// // @desc    Get all hostels
// // @route   GET /api/v1/hostels
// // @access  Public
// exports.getHostels = async (req, res, next) => {
//   console.log("Get hostels called");
//   try {
//     // Copy req.query
//     const reqQuery = { ...req.query };
    
//     // Fields to exclude
//     const removeFields = ['select', 'sort', 'page', 'limit'];
//     removeFields.forEach(param => delete reqQuery[param]);
    
//     // Create query string
//     let queryStr = JSON.stringify(reqQuery);
    
//     // Create operators ($gt, $gte, etc)
//     queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
//     // Finding resource
//     let query = Hostel.find(JSON.parse(queryStr)).populate('owner', 'name email phone');
    
//     // Select fields
//     if (req.query.select) {
//       const fields = req.query.select.split(',').join(' ');
//       query = query.select(fields);
//     }
    
//     // Sort
//     if (req.query.sort) {
//       const sortBy = req.query.sort.split(',').join(' ');
//       query = query.sort(sortBy);
//     } else {
//       query = query.sort('-createdAt');
//     }
    
//     // Pagination
//     const page = parseInt(req.query.page, 10) || 1;
//     const limit = parseInt(req.query.limit, 10) || 10;
//     const startIndex = (page - 1) * limit;
//     const endIndex = page * limit;
//     const total = await Hostel.countDocuments(JSON.parse(queryStr));
    
//     query = query.skip(startIndex).limit(limit);
    
//     // Executing query
//     const hostels = await query;
    
//     // Pagination result
//     const pagination = {};
    
//     if (endIndex < total) {
//       pagination.next = {
//         page: page + 1,
//         limit
//       };
//     }
    
//     if (startIndex > 0) {
//       pagination.prev = {
//         page: page - 1,
//         limit
//       };
//     }
    
//     res.status(200).json({
//       success: true,
//       count: hostels.length,
//       pagination,
//       data: hostels
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server Error'
//     });
//   }
// };

// // @desc    Get single hostel
// // @route   GET /api/v1/hostels/:id
// // @access  Public
// exports.getHostel = async (req, res, next) => {
//   try {
//     const hostel = await Hostel.findById(req.params.id)
//       .populate('owner', 'name email phone')
//       .populate({
//         path: 'reviews',
//         populate: {
//           path: 'user',
//           select: 'name profileImage'
//         }
//       });
    
//     if (!hostel) {
//       return res.status(404).json({
//         success: false,
//         message: 'Hostel not found'
//       });
//     }
    
//     res.status(200).json({
//       success: true,
//       data: hostel
//     });
//   } catch (error) {
//     console.log('Error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server Error'
//     });
//   }
// };

// // @desc    Create hostel
// // @route   POST /api/v1/hostels
// // @access  Private
// exports.createHostel = async (req, res, next) => {
//   try {
//     // Add owner to req.body
//     console.log("User ID:", req.body.id);
//     // req.body.owner = req.user.id;
     
  
//     // Get coordinates from address
//     const fullAddress = `${req.body.address.street}, ${req.body.address.city}, ${req.body.address.state}, ${req.body.address.pincode}, ${req.body.address.country}`;
    
//     try {
//       const coordinates = await getCoordinates(fullAddress);
//       req.body.address.coordinates = coordinates;
//     } catch (error) {
//       console.log('Geocoding error:', error.message);
//     }
    
//     const hostel = await Hostel.create(req.body);
    
//     res.status(201).json({
//       success: true,
//       data: hostel
//     });
//   } catch (error) {
//     if (error.name === 'ValidationError') {
//       const messages = Object.values(error.errors).map(val => val.message);
      
//       return res.status(400).json({
//         success: false,
//         message: messages.join(', ')
//       });
//     } else {
//       console.log('Error:', error); 
//       res.status(500).json({
//         success: false,
//         message: 'Server Error'
//       });
//     }
//   }
// };

// // @desc    Update hostel
// // @route   PUT /api/v1/hostels/:id
// // @access  Private
// exports.updateHostel = async (req, res, next) => {
 
//   try {
//     let hostel = await Hostel.findById(req.params.id);
     
//     if (!hostel) {
//       return res.status(404).json({
//         success: false,
//         message: 'Hostel not found'
//       });
//     }
//       console.log("Hostel found:", hostel);
//     // Check ownership
//     if (hostel.owner.toString() !== req.user.id) {
//       return res.status(403).json({
//         success: false,
//         message: 'Not authorized to update this hostel'
//       });
//     }
  
//     // If address is being updated, get new coordinates
//     if (req.body.address) {
//       console.log("Address is being updated");
//       const fullAddress = `${req.body.address.street || hostel.address.street}, ${req.body.address.city || hostel.address.city}, ${req.body.address.state || hostel.address.state}, ${req.body.address.pincode || hostel.address.pincode}, ${req.body.address.country || hostel.address.country}`;
      
//       try {
//         const coordinates = await getCoordinates(fullAddress);
//         req.body.address.coordinates = coordinates;
//       } catch (error) {
//         console.log('Geocoding error:', error.message);
//       }
//     }
    
//     hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//       runValidators: true
//     });
//     console.log('mklx',hostel);
//     res.status(200).json({
//       success: true,
//       data: hostel
//     });
//   } catch (error) {
//     console.log('Error:', error);
//     if (error.name === 'ValidationError') {
//       const messages = Object.values(error.errors).map(val => val.message);
      
//       return res.status(400).json({
//         success: false,
//         message: messages.join(', ')
//       });
//     } else {
//       res.status(500).json({
//         success: false,
//         message: 'Server Error'
//       });
//     }
//   }
// };

// // @desc    Delete hostel
// // @route   DELETE /api/v1/hostels/:id
// // @access  Private
// exports.deleteHostel = async (req, res, next) => {
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
//         message: 'Not authorized to delete this hostel'
//       });
//     }
    
//     // Delete associated images from Cloudinary
//     if (hostel.images && hostel.images.length > 0) {
//       for (const image of hostel.images) {
//         const publicId = image.url.split('/').pop().split('.')[0];
//         await deleteImage(`hostels/${publicId}`);
//       }
//     }
    
//     await hostel.deleteOne();
    
//     res.status(200).json({
//       success: true,
//       data: {}
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Server Error'
//     });
//   }
// };

// // @desc    Upload images for hostel
// // @route   PUT /api/v1/hostels/:id/images
// // @access  Private
// // exports.uploadHostelImages = async (req, res, next) => {
// //   try {
// //     const hostel = await Hostel.findById(req.params.id);
    
// //     if (!hostel) {
// //       return res.status(404).json({
// //         success: false,
// //         message: 'Hostel not found'
// //       });
// //     }
    
// //     // Check ownership
// //     if (hostel.owner.toString() !== req.user.id) {
// //       return res.status(403).json({
// //         success: false,
// //         message: 'Not authorized to update this hostel'
// //       });
// //     }
    
// //     if (!req.files) {
// //       return res.status(400).json({
// //         success: false,
// //         message: 'Please upload an image'
// //       });
// //     }
    
// //     const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
// //     const uploadedImages = [];
    
// //     // Upload images
// //     for (const file of imageFiles) {
// //       const result = await uploadImage(file.tempFilePath, 'hostels');
      
// //       uploadedImages.push({
// //         url: result.secure_url,
// //         caption: file.name,
// //         isPrimary: false
// //       });
// //     }
    
// //     // Add new images to hostel
// //     hostel.images = [...hostel.images, ...uploadedImages];
// //     await hostel.save();
    
// //     res.status(200).json({
// //       success: true,
// //       data: hostel.images
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       message: 'Server Error'
// //     });
// //   }
// // };

// // @desc    Delete hostel image
// // @route   DELETE /api/v1/hostels/:id/images/:imageId
// // @access  Private
// exports.deleteHostelImage = async (req, res, next) => {
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
    
//     const imageIndex = hostel.images.findIndex(
//       image => image._id.toString() === req.params.imageId
//     );
    
//     if (imageIndex === -1) {
//       return res.status(404).json({
//         success: false,
//         message: 'Image not found'
//       });
//     }
    
//     const imageToDelete = hostel.images[imageIndex];
    
//     // Delete image from Cloudinary
//     const publicId = imageToDelete.url.split('/').pop().split('.')[0];
//     await deleteImage(`hostels/${publicId}`);
    
//     // Remove image from array
//     hostel.images.splice(imageIndex, 1);
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

// // @desc    Get hostels within radius
// // @route   GET /api/v1/hostels/radius/:zipcode/:distance
// // @access  Public
// exports.getHostelsInRadius = async (req, res, next) => {
//   try {
//     const { zipcode, distance } = req.params;
    
//     // Get lat/lng from geocoder
//     const loc = await geocoder.geocode(zipcode);
//     const lat = loc[0].latitude;
//     const lng = loc[0].longitude;
    
//     // Calc radius using radians
//     // Divide distance by radius of Earth (3,963 mi / 6,378 km)
//     const radius = distance / 3963;
    
//     const hostels = await Hostel.find({
//       'address.coordinates': {
//         $geoWithin: { $centerSphere: [[lng, lat], radius] }
//       }
//     });
    
//     res.status(200).json({
//       success: true,
//       count: hostels.length,
//       data: hostels
//     });
//   } catch (error) {
//     console.log('Error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Server Error'
//     });
//   }
// };

const Property = require('../models/hostelschema');
const { geocoder } = require('../utils/geocoder');

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

// @desc    Get all properties with advanced filtering
// @route   GET /api/v1/properties
// @access  Public
// @desc    Get all properties with advanced filtering
// @route   GET /api/v1/properties
// @access  Public

exports.getProperties = async (req, res) => {
  try {
 
    
    const queryObj = {};
    
    // Check if this is a "current location" search (has lat/lng but city is "Unknown" or missing)
    const isCurrentLocationSearch = req.query.lat && req.query.lng && 
      (!req.query.city || req.query.city === 'Unknown' || req.query.locationType === 'current');
    
    const excludedFields = ['page', 'limit', 'sort', 'fields', 'lat', 'lng', 'radius', 'nearme', 'city', 'area', 'locationType'];
    
    // Build query object
    Object.keys(req.query).forEach(key => {
      if (!excludedFields.includes(key)) {
        queryObj[key] = req.query[key];
      }
    });

    console.log('Initial queryObj:', queryObj);

    // Status filter
    if (req.query.status) {
      queryObj.status = req.query.status;
    }

    // Property type filter
    if (req.query.propertyType && req.query.propertyType !== 'all') {
      queryObj.propertyType = req.query.propertyType;
    }

    // Budget filters
    if (req.query.budget === 'under10k') {
      queryObj['pricing.monthlyRent.amount'] = { $lt: 10000 };
    } else if (req.query.budget === 'under15k') {
      queryObj['pricing.monthlyRent.amount'] = { $lt: 15000 };
    }

    // Premium filter
    if (req.query.premium === 'true') {
      queryObj['pricing.priceCategory'] = { $in: ['premium', 'luxury'] };
    }

    // Top Rated filter
    if (req.query.rated === 'top') {
      queryObj['rating.average'] = { $gte: 4.5 };
    }

    // Food included filter
    if (req.query.food === 'included') {
      queryObj['food.provided'] = true;
    }

    // Amenities filter
    if (req.query.amenities) {
      const amenities = req.query.amenities.split(',');
      queryObj.amenities = { $all: amenities };
    }

    // 🔥 LOCATION FILTERING LOGIC - PRIORITY BASED
    
    // Priority 1: Current Location Search (Geospatial) - When city is Unknown or not provided
    if (isCurrentLocationSearch) {
      const { lat, lng } = req.query;
      const radius = parseInt(req.query.radius, 10) || 10; // Default 10km
      
      queryObj['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      };
      
      console.log('🔥 Using CURRENT LOCATION geospatial query:', { lat, lng, radius: radius + 'km' });
    }
    
    // Priority 2: "Near Me" explicit query
    else if (req.query.nearme === 'true' && req.query.lat && req.query.lng) {
      const { lat, lng, radius = 3 } = req.query;
      
      queryObj['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000
        }
      };
      console.log('🔥 Using NEAR ME geospatial query:', { lat, lng, radius: radius + 'km' });
    }
    
    // Priority 3: City AND/OR Area filtering
    else {
      const locationConditions = [];

      // City filtering
      if (req.query.city && req.query.city.trim() !== '' && req.query.city !== 'Unknown') {
        const cityName = req.query.city.trim();
        locationConditions.push({
          'location.address.city': { 
            $regex: `^${cityName}$`, 
            $options: 'i' 
          }
        });
        console.log('🔥 City filter added:', cityName);
      }

      // Area filtering
      if (req.query.area && req.query.area.trim() !== '' && req.query.area !== 'Unknown') {
        const areaName = req.query.area.trim();
        locationConditions.push({
          'location.address.area': { 
            $regex: `^${areaName}$`, 
            $options: 'i' 
          }
        });
        console.log('🔥 Area filter added:', areaName);
      }

      // Apply location filters
      if (locationConditions.length === 1) {
        Object.assign(queryObj, locationConditions[0]);
      } else if (locationConditions.length === 2) {
        queryObj.$and = locationConditions;
        console.log('🔥 Using $and for city + area filter');
      }
    }

    // Other filters
    if (req.query.available === 'true') {
      queryObj['availability.availableUnits'] = { $gt: 0 };
    }

    if (req.query.gender) {
      queryObj.subType = req.query.gender;
    }

    if (req.query.furnished) {
      queryObj['unitDetails.furnished'] = req.query.furnished;
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10; // Default 10 for pagination
    const skip = (page - 1) * limit;

    console.log('Final queryObj:', JSON.stringify(queryObj, null, 2));

    // Build and execute query
    let query = Property.find(queryObj);

    // Sorting - For geospatial queries, MongoDB sorts by distance automatically
    if (!isCurrentLocationSearch && !req.query.nearme) {
      if (req.query.sort) {
        const sortBy = req.query.sort.split(',').join(' ');
        query = query.sort(sortBy);
      } else {
        query = query.sort('-featured.isFeatured -featured.featurePriority -rating.average -createdAt');
      }
    }

    query = query.skip(skip).limit(limit);
    query = query.populate('owner', 'name phone email profileImage');

    // Execute query
    const [properties, total] = await Promise.all([
      query.exec(),
      Property.countDocuments(queryObj)
    ]);

    console.log(`✅ Found ${properties.length} properties (page ${page}, limit ${limit})`);

    // Add distance info for current location searches
    if (isCurrentLocationSearch && req.query.lat && req.query.lng) {
      const userLat = parseFloat(req.query.lat);
      const userLng = parseFloat(req.query.lng);
      
      properties.forEach(prop => {
        const propCoords = prop.location?.coordinates?.coordinates;
        if (propCoords && Array.isArray(propCoords) && propCoords.length >= 2) {
          const distance = calculateDistance(userLat, userLng, propCoords[1], propCoords[0]);
          prop._doc.distance = distance.toFixed(2);
          prop._doc.distanceFormatted = distance < 1 
            ? `${(distance * 1000).toFixed(0)}m away` 
            : `${distance.toFixed(1)}km away`;
        }
      });
    }

    return res.status(200).json({
      success: true,
      count: properties.length,
      total,
      filters: {
        city: req.query.city || null,
        area: req.query.area || null,
        isCurrentLocation: isCurrentLocationSearch,
        query: queryObj
      },
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: properties
    });

  } catch (error) {
    console.error('❌ Get Properties Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

//@desc    Get single property
// @route   GET /api/v1/properties/:id
// @access  Public
exports.getProperty = async (req, res) => {
  try {
    console.log('get single hostel')
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name phone email profileImage')
      .populate('reviews');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Increment view count
    property.stats.totalViews += 1;
    property.stats.lastViewedAt = Date.now();
    await property.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      data: property
    });

  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create property
// @route   POST /api/v1/properties
// @access  Private
exports.createProperty = async (req, res) => {
  try {
    req.body.owner = req.user.id;

    // Geocode address to get coordinates
    if (!req.body.location?.coordinates?.coordinates) {
      const address = `${req.body.location.address.street}, ${req.body.location.address.area}, ${req.body.location.address.city}`;
      const geoData = await geocoder.geocode(address);
      
      if (geoData && geoData.length > 0) {
        req.body.location.coordinates = {
          type: 'Point',
          coordinates: [geoData[0].longitude, geoData[0].latitude]
        };
      }
    }

    const property = await Property.create(req.body);

    res.status(201).json({
      success: true,
      data: property
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update property
// @route   PUT /api/v1/properties/:id
// @access  Private
exports.updateProperty = async (req, res) => {
  try {
    let property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ 
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    // if (property.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Not authorized'
    //   });
    // }

    // Recalculate coordinates if address changed
    if (req.body.location?.address) {
      const addr = req.body.location.address;
      const address = `${addr.street || property.location.address.street}, ${addr.area || property.location.address.area}, ${addr.city || property.location.address.city}`;
      const geoData = await geocoder.geocode(address);
      
      if (geoData && geoData.length > 0) {
        req.body.location.coordinates = {
          type: 'Point',
          coordinates: [geoData[0].longitude, geoData[0].latitude]
        };
      }
    }

    property = await Property.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: property
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Delete property
// @route   DELETE /api/v1/properties/:id
// @access  Private
exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await property.deleteOne();

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

// @desc    Get properties near a location
// @route   GET /api/v1/properties/nearby
// @access  Public
exports.getNearbyProperties = async (req, res) => {
  try {
    const { lat, lng, radius = 5, propertyType } = req.query; // radius in km

    const query = {
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radius * 1000
        }
      },
      status: 'active'
    };

    if (propertyType && propertyType !== 'all') {
      query.propertyType = propertyType;
    }

    const properties = await Property.find(query)
      .limit(20)
      .populate('owner', 'name phone');

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Search properties by text
// @route   GET /api/v1/properties/search
// @access  Public
exports.searchProperties = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Please provide search query'
      });
    }

    const properties = await Property.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { 'location.address.area': { $regex: q, $options: 'i' } },
        { 'location.address.city': { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ],
      status: 'active'
    }).limit(20);

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get featured properties
// @route   GET /api/v1/properties/featured
// @access  Public
exports.getFeaturedProperties = async (req, res) => {
  try {
    const properties = await Property.find({
      'featured.isFeatured': true,
      'featured.featuredUntil': { $gt: new Date() },
      status: 'active'
    })
    .sort('-featured.featurePriority -rating.average')
    .limit(10)
    .populate('owner', 'name phone');
    console.log('properties',properties)
    res.status(200).json({
      success: false,
      count: properties.length,
      data: properties
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// Helper function: Calculate distance between two points
// function calculateDistance(lat1, lng1, lat2, lng2) {
//   const R = 6371; // Earth's radius in km
//   const dLat = (lat2 - lat1) * Math.PI / 180;
//   const dLng = (lng2 - lng1) * Math.PI / 180;
//   const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
//             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
//             Math.sin(dLng/2) * Math.sin(dLng/2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//   return R * c;
// }

// @desc    Get properties by specific area with distance calculation
// @route   GET /api/v1/properties/area/:areaName
// @access  Public
exports.getPropertiesByArea = async (req, res) => {
  try {
    const { areaName } = req.params;
    const { city, lat, lng, radius = 2 } = req.query; // 2km radius around area center

    // Find area center coordinates (you can store these in a separate collection)
    // For now, use provided coordinates or geocode the area
    let areaCenter = null;
    
    if (lat && lng) {
      areaCenter = { lat: parseFloat(lat), lng: parseFloat(lng) };
    } else {
      // Geocode area to get center
      const geoData = await geocoder.geocode(`${areaName}, ${city || ''}`);
      if (geoData.length > 0) {
        areaCenter = { lat: geoData[0].latitude, lng: geoData[0].longitude };
      }
    }

    let properties;

    if (areaCenter) {
      // Find properties within radius of area center
      properties = await Property.find({
        status: 'active',
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [areaCenter.lng, areaCenter.lat]
            },
            $maxDistance: radius * 1000
          }
        }
      })
      .limit(50)
      .populate('owner', 'name phone email profileImage');

      // Add distance from area center
      properties = properties.map(prop => {
        const propCoords = prop.location.coordinates.coordinates;
        const distance = calculateDistance(
          areaCenter.lat,
          areaCenter.lng,
          propCoords[1],
          propCoords[0]
        );
        
        return {
          ...prop.toObject(),
          distanceFromAreaCenter: distance.toFixed(2),
          areaName: areaName
        };
      });

    } else {
      // Fallback to text-based area search
      properties = await Property.find({
        status: 'active',
        'location.address.area': { $regex: areaName, $options: 'i' }
      })
      .limit(50)
      .populate('owner', 'name phone email profileImage');
    }

    res.status(200).json({
      success: true,
      count: properties.length,
      area: areaName,
      center: areaCenter,
      radius: `${radius}km`,
      data: properties
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get nearby areas (for "Explore Nearby" feature)
// @route   GET /api/v1/properties/nearby-areas
// @access  Public
exports.getNearbyAreas = async (req, res) => {
  try {
    let { lat, lng, radius = 10, page = 1, limit = 10, propertyType, gender, maxPrice, minPrice } = req.query;
    
    // Validation
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Please provide lat and lng'
      });
    }

    lat = parseFloat(lat);
    lng = parseFloat(lng);
    radius = parseFloat(radius);
    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    console.log('📍 Get Nearby PGs:', { lat, lng, radius, page, limit });

    // Build match stage for filters
    const matchStage = {
      isActive: true,
      status: 'active',
      'availability.availableUnits': { $gt: 0 }
    };

    // Add property type filter
    if (propertyType && propertyType !== 'all') {
      matchStage.propertyType = propertyType;
    }

    // Add gender filter (maps to subType)
    if (gender && gender !== 'all') {
      const genderMap = {
        'male': 'boys',
        'female': 'girls',
        'coed': 'coed'
      };
      matchStage.subType = genderMap[gender] || gender;
    }

    // Add price filter
    if (maxPrice || minPrice) {
      matchStage['pricing.monthlyRent.amount'] = {};
      if (minPrice) matchStage['pricing.monthlyRent.amount'].$gte = parseInt(minPrice);
      if (maxPrice) matchStage['pricing.monthlyRent.amount'].$lte = parseInt(maxPrice);
    }

    const userPoint = {
      type: 'Point',
      coordinates: [lng, lat] // GeoJSON: [longitude, latitude]
    };

    // Aggregation pipeline - FIXED SYNTAX
    const pipeline = [
      // Stage 1: Geospatial match with distance calculation
      {
        $geoNear: {
          near: userPoint,
          distanceField: 'distance', // in meters
          maxDistance: radius * 1000, // convert km to meters
          spherical: true,
          query: matchStage
        }
      },
      
      // Stage 2: Convert distance to km and add display fields - FIXED
      {
        $addFields: {
          distanceKm: { $round: [{ $divide: ['$distance', 1000] }, 1] },
          distanceMeters: { $multiply: [{ $divide: ['$distance', 1000] }, 1000] }
        }
      },
      
      // Stage 3: Add computed display fields - FIXED
      {
        $addFields: {
          distanceDisplay: {
            $cond: {
              if: { $lt: ['$distanceKm', 1] },
              then: {
                $concat: [
                  { $toString: { $round: ['$distanceMeters'] } },
                  ' m'
                ]
              },
              else: {
                $concat: [
                  { $toString: '$distanceKm' },
                  ' km'
                ]
              }
            }
          },
          // Calculate ETA (assuming 25 km/h average speed = 2.4 min per km)
          etaMinutes: { $round: [{ $multiply: ['$distanceKm', 2.4] }, 0] }
        }
      },

      // Stage 4: Lookup area details
      {
        $lookup: {
          from: 'areas',
          localField: 'location.address.area',
          foreignField: 'name',
          as: 'areaDetails'
        }
      },
      {
        $unwind: { path: '$areaDetails', preserveNullAndEmptyArrays: true }
      },

      // Stage 5: Project only needed fields
      {
        $project: {
          _id: 1,
          name: 1,
          displayName: { $ifNull: ['$displayName', '$name'] },
          propertyType: 1,
          subType: 1,
          'location.address': 1,
          'location.coordinates': 1,
          'pricing.monthlyRent': 1,
          'pricing.securityDeposit': 1,
          images: { $slice: ['$images', 1] }, // Only first image
          rating: 1,
          amenities: 1,
          food: 1,
          distance: 1,
          distanceKm: 1,
          distanceDisplay: 1,
          etaMinutes: 1,
          areaDetails: {
            name: '$areaDetails.name',
            displayName: '$areaDetails.displayName'
          }
        }
      },

      // Stage 6: Sort by distance (nearest first)
      { $sort: { distance: 1 } },

      // Stage 7: Pagination - get one extra to check if more exist
      { $skip: (page - 1) * limit },
      { $limit: limit + 1 }
    ];

    const pgs = await Property.aggregate(pipeline);

    // Check if more pages exist
    const hasMore = pgs.length > limit;
    if (hasMore) pgs.pop(); // Remove the extra document

    // Group by distance ranges for UI sections
    const groupedByDistance = {
      veryNear: [],    // 0-1 km
      near: [],        // 1-3 km
      moderate: [],    // 3-5 km
      far: [],         // 5-10 km
      veryFar: []      // >10 km
    };

    const formattedPGs = pgs.map(pg => {
      const pgData = {
        _id: pg._id,
        name: pg.name,
        displayName: pg.displayName,
        propertyType: pg.propertyType,
        subType: pg.subType,
        address: pg.location?.address,
        coordinates: pg.location?.coordinates,
        rent: pg.pricing?.monthlyRent?.amount,
        currency: pg.pricing?.monthlyRent?.currency || 'INR',
        deposit: pg.pricing?.securityDeposit?.amount,
        image: pg.images?.[0]?.url || null,
        rating: pg.rating?.average || 0,
        reviewCount: pg.rating?.count || 0,
        amenities: pg.amenities?.slice(0, 5) || [], // Top 5 amenities
        foodProvided: pg.food?.provided || false,
        foodType: pg.food?.type || null,
        distanceKm: pg.distanceKm,
        distanceDisplay: pg.distanceDisplay,
        etaMinutes: pg.etaMinutes,
        etaDisplay: pg.etaMinutes <= 5 ? '5 min' : 
                    pg.etaMinutes < 60 ? `${pg.etaMinutes} min` : 
                    `${Math.round(pg.etaMinutes/60)} hr`,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${pg.location?.coordinates?.coordinates?.[1]},${pg.location?.coordinates?.coordinates?.[0]}&travelmode=driving`,
        areaName: pg.areaDetails?.displayName || pg.location?.address?.area
      };

      // Group by distance range
      if (pg.distanceKm <= 1) groupedByDistance.veryNear.push(pgData);
      else if (pg.distanceKm <= 3) groupedByDistance.near.push(pgData);
      else if (pg.distanceKm <= 5) groupedByDistance.moderate.push(pgData);
      else if (pg.distanceKm <= 10) groupedByDistance.far.push(pgData);
      else groupedByDistance.veryFar.push(pgData);

      return pgData;
    });

    // Get location context from Google (optional, for display)
    let locationContext = null;
    try {
      const googleApiKey = process.env.GEOCODER_API_KEY;
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`;
      const geoRes = await axios.get(geocodeUrl);
      if (geoRes.data.status === 'OK') {
        locationContext = {
          formattedAddress: geoRes.data.results[0]?.formatted_address,
          city: geoRes.data.results[0]?.address_components?.find(c => 
            c.types.includes('locality') || c.types.includes('administrative_area_level_2')
          )?.long_name,
          area: geoRes.data.results[0]?.address_components?.find(c => 
            c.types.includes('neighborhood') || c.types.includes('sublocality')
          )?.long_name
        };
      }
    } catch (e) {
      console.log('Geocoding error (non-critical):', e.message);
    }

    res.status(200).json({
      success: true,
      meta: {
        userLocation: { lat, lng },
        locationContext,
        pagination: {
          currentPage: page,
          limit,
          hasMore,
          totalReturned: formattedPGs.length
        },
        searchRadius: radius,
        filters: { propertyType, gender, maxPrice, minPrice },
        stats: {
          totalFound: formattedPGs.length,
          byDistance: {
            veryNear: groupedByDistance.veryNear.length,
            near: groupedByDistance.near.length,
            moderate: groupedByDistance.moderate.length,
            far: groupedByDistance.far.length,
            veryFar: groupedByDistance.veryFar.length
          }
        }
      },
      // Flat list for infinite scroll
      data: formattedPGs,
      // Grouped for sectioned UI
      groupedByDistance,
      // Distance ranges info
      ranges: [
        { key: 'veryNear', label: 'Very Near', range: '0-1 km', count: groupedByDistance.veryNear.length },
        { key: 'near', label: 'Nearby', range: '1-3 km', count: groupedByDistance.near.length },
        { key: 'moderate', label: 'Moderate', range: '3-5 km', count: groupedByDistance.moderate.length },
        { key: 'far', label: 'Far', range: '5-10 km', count: groupedByDistance.far.length },
        { key: 'veryFar', label: 'Very Far', range: '>10 km', count: groupedByDistance.veryFar.length }
      ].filter(r => r.count > 0)
    });

  } catch (error) {
    console.error('❌ Get Nearby PGs Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};


// @desc    Get areas by city (for city-based area selection)
// @route   GET /api/v1/properties/areas?city=Bangalore
// @access  Public
exports.getAreasByCity = async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'Please provide city parameter'
      });
    }

    // Aggregate pipeline to get areas with property counts for a specific city
    const areas = await Property.aggregate([
      {
        $match: {
          status: 'active',
          'location.address.city': { 
            $regex: new RegExp(`^${city}$`, 'i') // Case-insensitive exact match
          }
        }
      },
      {
        $group: {
          _id: '$location.address.area',
          count: { $sum: 1 },
          // Get coordinates of first property in each area (for center point)
          coordinates: { 
            $first: '$location.coordinates.coordinates' 
          },
          city: { $first: '$location.address.city' }
        }
      },
      {
        $match: {
          _id: { $ne: null } // Exclude null areas
        }
      },
      {
        $sort: { count: -1 } // Sort by most properties first
      },
      {
        $limit: 20 // Limit to top 20 areas
      },
      {
        $project: {
          _id: 0,
          area: '$_id',
          count: 1,
          city: 1,
          coordinates: 1
        }
      }
    ]);

    // If no areas found with exact match, try partial match
    let finalAreas = areas;
    if (areas.length === 0) {
      const partialAreas = await Property.aggregate([
        {
          $match: {
            status: 'active',
            'location.address.city': { 
              $regex: city, 
              $options: 'i' 
            }
          }
        },
        {
          $group: {
            _id: '$location.address.area',
            count: { $sum: 1 },
            coordinates: { 
              $first: '$location.coordinates.coordinates' 
            },
            city: { $first: '$location.address.city' }
          }
        },
        {
          $match: {
            _id: { $ne: null }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 20
        },
        {
          $project: {
            _id: 0,
            area: '$_id',
            count: 1,
            city: 1,
            coordinates: 1
          }
        }
      ]);
      finalAreas = partialAreas;
    }

    res.status(200).json({
      success: true,
      count: finalAreas.length,
      city: city,
      data: finalAreas
    });

  } catch (error) {
    console.error('Get Areas By City Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};