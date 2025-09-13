const NodeGeocoder = require('node-geocoder');

const options = {
  provider: process.env.GEOCODER_PROVIDER || 'openstreetmap',
  httpAdapter: 'https',
  apiKey: process.env.GEOCODER_API_KEY || null, // only required for Google, etc.
  formatter: null
};

const geocoder = NodeGeocoder(options);

// Helper function (optional)
async function getCoordinates(address) {
  try {
    const geoData = await geocoder.geocode(address);
    
    if (!geoData.length) {
      throw new Error('No coordinates found for this address');
    }

    return {
      latitude: geoData[0].latitude,
      longitude: geoData[0].longitude
    };
  } catch (error) {
    throw new Error('Geocoding failed');
  }
}

module.exports = { geocoder, getCoordinates };
