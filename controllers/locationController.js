const State = require('../models/state');
const City = require('../models/city');
const Area = require('../models/area');
const Property = require('../models/hostelschema');
const axios = require('axios');


// @desc    Get all active states
// @route   GET /api/v1/location/states
// @access  Public
exports.getStates = async (req, res) => {
  try {
    const states = await State.find({ isActive: true })
      .select('name code totalCities totalProperties')
      .sort('name');

    res.status(200).json({
      success: true,
      count: states.length,
      data: states
    });
  } catch (error) {
    console.error('Get States Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get cities by state
// @route   GET /api/v1/location/cities?stateId=xxx
// @access  Public
exports.getCities = async (req, res) => {
  try {
    const { stateId, stateName, popularOnly } = req.query;
    
    let query = { isActive: true };
    
    if (stateId) {
      query.state = stateId;
    } else if (stateName) {
      const state = await State.findOne({ 
        name: { $regex: new RegExp(`^${stateName}$`, 'i') } 
      });
      if (!state) {
        return res.status(404).json({
          success: false,
          message: 'State not found'
        });
      }
      query.state = state._id;
    }

    if (popularOnly === 'true') {
      query.isPopular = true;
    }

    const cities = await City.find(query)
      .select('name stateName totalAreas totalProperties isPopular')
      .populate('state', 'name code')
      .sort({ isPopular: -1, name: 1 });

    res.status(200).json({
      success: true,
      count: cities.length,
      data: cities
    });
  } catch (error) {
    console.error('Get Cities Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get areas by city
// @route   GET /api/v1/location/areas?cityId=xxx
// @access  Public
exports.getAreas = async (req, res) => {
  try {
    const { cityId, cityName } = req.query;
    
    let query = { isActive: true };
    
    if (cityId) {
      query.city = cityId;
    } else if (cityName) {
      const city = await City.findOne({ 
        name: { $regex: new RegExp(`^${cityName}$`, 'i') } 
      });
      if (!city) {
        return res.status(404).json({
          success: false,
          message: 'City not found'
        });
      }
      query.city = city._id;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide cityId or cityName'
      });
    }

    const areas = await Area.find(query)
      .select('name displayName cityName stateName location propertyCount pincode isPopular')
      .sort({ isPopular: -1, propertyCount: -1, name: 1 });

    // Transform data to match frontend expectations
    const formattedAreas = areas.map(area => ({
      _id: area._id,
      name: area.name,
      displayName: area.displayName || area.name,
      cityName: area.cityName,
      stateName: area.stateName,
      propertyCount: area.propertyCount,
      pincode: area.pincode,
      coordinates: area.location?.coordinates, // [lng, lat]
      isPopular: area.isPopular
    }));

    res.status(200).json({
      success: true,
      count: areas.length,
      data: formattedAreas
    });
  } catch (error) {
    console.error('Get Areas Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get nearby areas based on coordinates
// @route   GET /api/v1/location/nearby-areas?lat=xx&lng=xx&radius=5
// @access  Public

function isStreetNumber(name) {
  if (!name) return false;
  // "2-56/37/195", "12", "45A", "Plot 23", "Flat 301", "Door 5", "#123", "Block A"
  if (/^\d[\d\-\/\.]*$/.test(name)) return true;
  if (/^\d+\s*[a-z]?$/i.test(name)) return true;
  if (/^(plot|door|flat|house|building|blk|block|#|no|num|number)\s*\.?\s*\d+/i.test(name)) return true;
  if (/^\d+\s*[-\/]\s*\d+/.test(name)) return true;
  return false;
}

// Helper function to extract location from Google Geocoding result
function extractLocationFromGoogleResult(result) {
  const components = result.address_components;
  
  // Build component map
  const componentMap = {};
  components.forEach(c => {
    c.types.forEach(type => {
      if (!componentMap[type]) componentMap[type] = [];
      componentMap[type].push(c.long_name);
    });
  });
  
  console.log('📍 Components:', components.map(c => `${c.long_name} [${c.types.join('|')}]`));
  
  // Extract city
  const cityName = 
    componentMap.locality?.[0] ||
    componentMap.administrative_area_level_2?.[0] ||
    componentMap.postal_town?.[0] ||
    'Unknown Location';
  
  console.log('📍 City detected:', cityName);
  
  // Extract area - FILTER OUT STREET NUMBERS
  let areaCandidates = [
  ...(componentMap.neighborhood || []),       // ⭐ Highest priority
  ...(componentMap.sublocality_level_2 || []),
  ...(componentMap.sublocality_level_1 || []),
  ...(componentMap.sublocality || []),
  ...(componentMap.route || [])
].filter(name => 
    name && 
    name !== cityName && 
    !name.includes(cityName) &&
    !isStreetNumber(name) &&
    name.length > 3
  );
  
  console.log('📍 Area candidates from components:', areaCandidates);
  
  let areaName = areaCandidates[0];
  
  // If no good candidates, parse from formatted address
  if (!areaName) {
    const parts = result.formatted_address.split(',').map(p => p.trim());
    console.log('📍 Parsing formatted address:', parts);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Skip street numbers
      if (isStreetNumber(part)) {
        console.log(`  [${i}] ⏭️ Skip street number: "${part}"`);
        continue;
      }
      
      // Skip metadata
      if (part === cityName) {
        console.log(`  [${i}] ⏭️ Skip city: "${part}"`);
        continue;
      }
      if (part.includes(cityName) && part.length < cityName.length + 5) continue;
      if (part.length < 4) continue;
      if (/^[A-Z]{2}$/.test(part)) continue; // State code
      if (/^\d{5,}$/.test(part)) continue; // Zip code
      
      // Skip Indian states
      const states = ['telangana', 'andhra pradesh', 'karnataka', 'maharashtra', 'delhi', 'tamil nadu', 'kerala', 'west bengal', 'rajasthan', 'punjab', 'haryana', 'gujarat', 'madhya pradesh', 'bihar', 'jharkhand', 'chhattisgarh', 'goa', 'himachal pradesh', 'jammu and kashmir', 'ladakh', 'meghalaya', 'manipur', 'mizoram', 'nagaland', 'odisha', 'puducherry', 'assam', 'tripura', 'uttar pradesh', 'uttarakhand'];
      if (states.some(s => part.toLowerCase().includes(s))) continue;
      
      // Skip country
      if (/^(india|usa|uk|canada|australia|united kingdom|united states)$/i.test(part)) continue;
      
      // ✅ VALID AREA
      areaName = part;
      console.log(`  [${i}] ✅ Selected area: "${part}"`);
      break;
    }
  }
  
  // Final fallback
  if (!areaName) {
    areaName = componentMap.route?.[0] || `Near ${cityName}`;
    console.log('📍 Fallback to:', areaName);
  }
  
  console.log('✅ FINAL:', { city: cityName, area: areaName });
  
  return {
    city: cityName,
    area: areaName,
    fullAddress: result.formatted_address || ''
  };
}


// Main controller
exports.getNearbyAreas = async (req, res) => {
  console.log('📍 getNearbyAreas called');
  
  try {
    let { 
      lat, lng, 
      city, area,
      radius = 5,
      page = 1, 
      limit = 10, 
      propertyType, 
      gender, 
      maxPrice, 
      minPrice,
      sortBy = 'distance'
    } = req.query;
    
    // Parse inputs
    lat = lat ? parseFloat(lat) : null;
    lng = lng ? parseFloat(lng) : null;
    radius = parseFloat(radius);
    page = parseInt(page);
    limit = parseInt(limit);

    console.log('📍 Parsed params:', { lat, lng, city, area, radius, page, limit });

    let userPoint = null;
    let searchMode = 'unknown';
    let detectedLocation = null;

    // Mode 1: Current Location (Use My Location button)
    if (lat && lng && !city && !area) {
      searchMode = 'current_location';
      userPoint = {
        type: 'Point',
        coordinates: [lng, lat] // GeoJSON: [longitude, latitude]
      };
      
      // Get human-readable location from Google
      try {
        const googleApiKey = process.env.GEOCODER_API_KEY;
        
        if (!googleApiKey) {
          console.log('⚠️ No Google API key configured');
          detectedLocation = {
            city: `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            area: 'Current Location',
            fullAddress: `${lat}, ${lng}`
          };
        } else {
          const geoRes = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`
          );
          
          console.log('📍 Google Geocoding status:', geoRes.data.status);
          
          if (geoRes.data.status === "OK" && geoRes.data.results?.length > 0) {
            const result = geoRes.data.results[0];
            
            console.log('📍 Formatted address:', result.formatted_address);
            
            detectedLocation = extractLocationFromGoogleResult(result);
            
            console.log('✅ Detected location:', detectedLocation);
          } else {
            console.log('❌ Geocoding failed:', geoRes.data.status, geoRes.data.error_message);
            detectedLocation = {
              city: `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              area: 'Current Location',
              fullAddress: `${lat}, ${lng}`
            };
          }
        }
      } catch (err) {
        console.error('❌ Geocoding error:', err.message);
        detectedLocation = {
          city: `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          area: 'Current Location',
          fullAddress: `${lat}, ${lng}`
        };
      }
    }
    
    // Mode 2: Specific Area Selected (City → Area flow)
    else if (city || area) {
      searchMode = 'area_based';
      
      detectedLocation = {
        city: city || area || 'Unknown',
        area: area || city || 'Unknown',
        fullAddress: `${area || ''}, ${city || ''}`
      };
      
      console.log('🏙️ Area-based search:', detectedLocation);
      
      // Try to find area center coordinates for distance calculation
      const areaDoc = area ? await Area.findOne({ 
        $or: [
          { name: { $regex: new RegExp(`^${area}$`, 'i') } },
          { displayName: { $regex: new RegExp(`^${area}$`, 'i') } }
        ]
      }) : null;

      if (areaDoc && areaDoc.center?.coordinates) {
        userPoint = {
          type: 'Point',
          coordinates: areaDoc.center.coordinates
        };
        lat = areaDoc.center.coordinates[1];
        lng = areaDoc.center.coordinates[0];
        console.log('📍 Using area center:', { lat, lng });
      }
    }

    if (!userPoint && !city && !area) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either lat/lng or city/area'
      });
    }

    // Build match stage for MongoDB aggregation
    const matchStage = {
      status: 'active',
      'availability.availableUnits': { $gt: 0 }
    };

    // Add property type filter
    if (propertyType && propertyType !== 'all') {
      matchStage.propertyType = propertyType;
    }

    // Add gender filter
    if (gender && gender !== 'all') {
      const genderMap = { 'male': 'boys', 'female': 'girls', 'coed': 'coed' };
      matchStage.subType = genderMap[gender] || gender;
    }

    // Add city/area filters
    if (city) {
      matchStage['location.address.city'] = { $regex: new RegExp(city, 'i') };
    }
    if (area) {
      matchStage['location.address.area'] = { $regex: new RegExp(area, 'i') };
    }

    // Add price filter
    if (maxPrice || minPrice) {
      matchStage['pricing.monthlyRent.amount'] = {};
      if (minPrice) matchStage['pricing.monthlyRent.amount'].$gte = parseInt(minPrice);
      if (maxPrice) matchStage['pricing.monthlyRent.amount'].$lte = parseInt(maxPrice);
    }

    console.log('🔍 Match stage:', JSON.stringify(matchStage));

    let pipeline = [];

    // If we have coordinates, use $geoNear for distance calculation
    if (userPoint) {
      pipeline.push({
        $geoNear: {
          near: userPoint,
          distanceField: 'distance',
          maxDistance: radius * 1000, // Convert km to meters
          spherical: true,
          query: matchStage
        }
      });
    } else {
      // No coordinates - just match and add dummy distance for sorting
      pipeline.push({ $match: matchStage });
      pipeline.push({
        $addFields: {
          distance: 999999 // Large number so non-geospatial results sort to bottom
        }
      });
    }

    // Add computed distance fields
    pipeline.push({
      $addFields: {
       distanceKm: { $round: [{ $divide: ['$distance', 1000] }, 2] },
        distanceMeters: { $round: ['$distance', 0] },
        distanceDisplay: {
          $cond: {
            if: { $lt: ['$distance', 1000] },
            then: { $concat: [{ $toString: { $round: ['$distance', 0] } }, ' m'] },
            else: { $concat: [{ $toString: { $round: [{ $divide: ['$distance', 1000] }, 2] } }, ' km'] }
          }
        },
        etaMinutes: {
          $round: [{
            $cond: {
              if: { $lt: ['$distance', 1000] },
              then: { $divide: ['$distance', 80] }, // Walking: 80m/min
              else: { $multiply: [{ $divide: ['$distance', 1000] }, 2] } // Driving: 2min/km
            }
          }, 0]
        }
      }
    });

    // Lookup area details
    pipeline.push({
      $lookup: {
        from: 'areas',
        localField: 'location.address.area',
        foreignField: 'name',
        as: 'areaDetails'
      }
    });
    pipeline.push({ $unwind: { path: '$areaDetails', preserveNullAndEmptyArrays: true } });

    // Project only needed fields
    pipeline.push({
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
        images: { $slice: ['$images', 1] },
        rating: 1,
        amenities: 1,
        food: 1,
        distance: 1,
        distanceKm: 1,
        distanceMeters: 1,
        distanceDisplay: 1,
        etaMinutes: 1,
        areaDetails: { name: 1, displayName: 1 }
      }
    });

    // Sorting
    if (sortBy === 'distance') {
      pipeline.push({ $sort: { distance: 1 } });
    } else if (sortBy === 'price') {
      pipeline.push({ $sort: { 'pricing.monthlyRent.amount': 1 } });
    } else if (sortBy === 'rating') {
      pipeline.push({ $sort: { 'rating.average': -1 } });
    }

    // Pagination
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit + 1 });

    console.log('🔍 Executing aggregation...');
    
    const properties = await Property.aggregate(pipeline);
    const hasMore = properties.length > limit;
    if (hasMore) properties.pop();

    console.log(`✅ Found ${properties.length} properties`);

    // Format response
    const formattedProperties = properties.map(pg => ({
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
      amenities: pg.amenities?.slice(0, 5) || [],
      foodProvided: pg.food?.provided || false,
      foodType: pg.food?.type || null,
      distance: pg.distance,
      distanceKm: pg.distanceKm,
      distanceMeters: pg.distanceMeters,
      distanceDisplay: pg.distanceDisplay,
      etaMinutes: pg.etaMinutes,
      etaDisplay: pg.etaMinutes <= 5 ? '5 min' : 
                  pg.etaMinutes < 60 ? `${pg.etaMinutes} min` : 
                  `${Math.round(pg.etaMinutes/60)} hr`,
      areaName: pg.areaDetails?.displayName || pg.location?.address?.area
    }));

    // Group by distance for UI
    const groupedByDistance = {
      veryNear: formattedProperties.filter(p => p.distanceMeters <= 500),
      near: formattedProperties.filter(p => p.distanceMeters > 500 && p.distanceMeters <= 1000),
      walking: formattedProperties.filter(p => p.distanceMeters > 1000 && p.distanceKm <= 2),
      close: formattedProperties.filter(p => p.distanceKm > 2 && p.distanceKm <= 5),
      far: formattedProperties.filter(p => p.distanceKm > 5 && p.distanceKm <= 10),
      veryFar: formattedProperties.filter(p => p.distanceKm > 10)
    };

    // Check service availability for current location mode
    let serviceAvailable = {
      cityInDatabase: true,
      hasProperties: formattedProperties.length > 0,
      isServiceable: true
    };
    let availableCities = [];
    
    if (searchMode === 'current_location' && detectedLocation) {
      const cityInDb = await City.findOne({ 
        name: { $regex: new RegExp(`^${detectedLocation.city}$`, 'i') } 
      });
      
      serviceAvailable = {
        cityInDatabase: !!cityInDb,
        hasProperties: formattedProperties.length > 0,
        isServiceable: !!cityInDb || formattedProperties.length > 0
      };
      
      if (!serviceAvailable.isServiceable) {
        console.log('⚠️ Service not available in:', detectedLocation.city);
        availableCities = await City.find({ isActive: true })
          .select('name stateName')
          .limit(10)
          .sort({ isPopular: -1, name: 1 });
      }
    }

    const response = {
      success: true,
      searchMode,
      detectedLocation,
      serviceAvailable,
      meta: {
        userLocation: lat && lng ? { lat, lng } : null,
        pagination: {
          currentPage: page,
          limit,
          hasMore,
          totalReturned: formattedProperties.length
        }
      },
      data: formattedProperties,
      groupedByDistance,
      ranges: [
        { key: 'veryNear', label: 'Very Near', range: '0-500 m', count: groupedByDistance.veryNear.length },
        { key: 'near', label: 'Near', range: '500 m - 1 km', count: groupedByDistance.near.length },
        { key: 'walking', label: 'Walking', range: '1-2 km', count: groupedByDistance.walking.length },
        { key: 'close', label: 'Close', range: '2-5 km', count: groupedByDistance.close.length },
        { key: 'far', label: 'Far', range: '5-10 km', count: groupedByDistance.far.length },
        { key: 'veryFar', label: 'Very Far', range: '>10 km', count: groupedByDistance.veryFar.length }
      ].filter(r => r.count > 0),
      availableCities: serviceAvailable.isServiceable ? [] : availableCities
    };

    console.log('✅ Response ready:', {
      searchMode: response.searchMode,
      detectedLocation: response.detectedLocation,
      propertiesCount: response.data.length,
      ranges: response.ranges.map(r => `${r.label}: ${r.count}`).join(', ')
    });

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Get Nearby Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: error.message 
    });
  }
};

// ─── Helper: Calculate distance between two coordinates (Haversine) ───────

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat2 || !lon2) return null;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

// @desc    Search areas by name
// @route   GET /api/v1/location/search-areas?q=koram
// @access  Public
exports.searchAreas = async (req, res) => {
  try {
    const { q, city, state } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least 2 characters to search'
      });
    }

    let searchQuery = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      isActive: true
    };

    if (city) searchQuery.cityName = { $regex: city, $options: 'i' };
    if (state) searchQuery.stateName = { $regex: state, $options: 'i' };

    const areas = await Area.find(searchQuery)
      .select('name displayName cityName stateName location propertyCount')
      .limit(20)
      .sort({ propertyCount: -1 });

    const formattedAreas = areas.map(area => ({
      _id: area._id,
      name: area.name,
      displayName: area.displayName || area.name,
      cityName: area.cityName,
      stateName: area.stateName,
      propertyCount: area.propertyCount,
      coordinates: area.location?.coordinates
    }));

    res.status(200).json({
      success: true,
      count: areas.length,
      data: formattedAreas
    });
  } catch (error) {
    console.error('Search Areas Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get popular cities
// @route   GET /api/v1/location/popular-cities
// @access  Public
exports.getPopularCities = async (req, res) => {
  try {
    const cities = await City.find({ isPopular: true, isActive: true })
      .select('name stateName totalProperties')
      .populate('state', 'name code')
      .limit(20)
      .sort({ totalProperties: -1 });

    res.status(200).json({
      success: true,
      count: cities.length,
      data: cities
    });
  } catch (error) {
    console.error('Get Popular Cities Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// ==================== ADMIN CONTROLLERS ====================

exports.createState = async (req, res) => {
  try {
    const state = await State.create(req.body);
    res.status(201).json({ success: true, data: state });
  } catch (error) {
    console.error('Create State Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'State already exists' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.createCity = async (req, res) => {
  try {
    const { name, stateId, coordinates } = req.body;
    
    const state = await State.findById(stateId);
    if (!state) {
      return res.status(404).json({ success: false, message: 'State not found' });
    }

    const city = await City.create({
      name,
      state: stateId,
      stateName: state.name,
      location: {
        type: 'Point',
        coordinates: coordinates // [lng, lat]
      }
    });

    await State.findByIdAndUpdate(stateId, { $inc: { totalCities: 1 } });

    res.status(201).json({ success: true, data: city });
  } catch (error) {
    console.error('Create City Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'City already exists in this state' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

exports.createArea = async (req, res) => {
  try {
    const { name, displayName, cityId, coordinates, pincode } = req.body;
    
    const city = await City.findById(cityId).populate('state');
    if (!city) {
      return res.status(404).json({ success: false, message: 'City not found' });
    }

    const area = await Area.create({
      name,
      displayName: displayName || name,
      city: cityId,
      cityName: city.name,
      state: city.state._id,
      stateName: city.state.name,
      location: {
        type: 'Point',
        coordinates: coordinates // [lng, lat]
      },
      pincode
    });

    await City.findByIdAndUpdate(cityId, { $inc: { totalAreas: 1 } });

    res.status(201).json({ success: true, data: area });
  } catch (error) {
    console.error('Create Area Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Area already exists in this city' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};