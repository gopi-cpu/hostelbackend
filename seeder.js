const mongoose = require('mongoose');
const State = require('../hostelbackend/models/state');
const City = require('../hostelbackend/models/city');
const Area = require('../hostelbackend/models/area');

const locationData = [
  {
    name: 'Karnataka',
    code: 'KA',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // [lng, lat]
    cities: [
      {
        name: 'Bangalore',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        isPopular: true,
        areas: [
          { name: 'Koramangala', location: { type: 'Point', coordinates: [77.6245, 12.9279] }, pincode: '560034' },
          { name: 'HSR Layout', location: { type: 'Point', coordinates: [77.6536, 12.9116] }, pincode: '560102' },
          { name: 'BTM Layout', location: { type: 'Point', coordinates: [77.6070, 12.9165] }, pincode: '560068' },
          { name: 'Indiranagar', location: { type: 'Point', coordinates: [77.6387, 12.9784] }, pincode: '560038' },
          { name: 'Whitefield', location: { type: 'Point', coordinates: [77.7499, 12.9698] }, pincode: '560066' },
          { name: 'Electronic City', location: { type: 'Point', coordinates: [77.6721, 12.8399] }, pincode: '560100' },
          { name: 'Marathahalli', location: { type: 'Point', coordinates: [77.6999, 12.9569] }, pincode: '560037' },
          { name: 'JP Nagar', location: { type: 'Point', coordinates: [77.5730, 12.9078] }, pincode: '560078' }
        ]
      },
      {
        name: 'Mysore',
        location: { type: 'Point', coordinates: [76.6394, 12.2958] },
        areas: [
          { name: 'Vijayanagar', location: { type: 'Point', coordinates: [76.6146, 12.3365] }, pincode: '570017' },
          { name: 'Gokulam', location: { type: 'Point', coordinates: [76.6283, 12.3254] }, pincode: '570002' }
        ]
      }
    ]
  },
  {
    name: 'Maharashtra',
    code: 'MH',
    location: { type: 'Point', coordinates: [72.8777, 19.0760] },
    cities: [
      {
        name: 'Mumbai',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        isPopular: true,
        areas: [
          { name: 'Andheri', location: { type: 'Point', coordinates: [72.8697, 19.1136] }, pincode: '400053' },
          { name: 'Bandra', location: { type: 'Point', coordinates: [72.8296, 19.0544] }, pincode: '400050' },
          { name: 'Powai', location: { type: 'Point', coordinates: [72.9046, 19.1176] }, pincode: '400076' }
        ]
      },
      {
        name: 'Pune',
        location: { type: 'Point', coordinates: [73.8567, 18.5204] },
        isPopular: true,
        areas: [
          { name: 'Koregaon Park', location: { type: 'Point', coordinates: [73.8960, 18.5362] }, pincode: '411001' },
          { name: 'Hinjewadi', location: { type: 'Point', coordinates: [73.7350, 18.5979] }, pincode: '411057' },
          { name: 'Kothrud', location: { type: 'Point', coordinates: [73.8139, 18.5074] }, pincode: '411038' }
        ]
      }
    ]
  },
  {
    name: 'Telangana',
    code: 'TS',
    location: { type: 'Point', coordinates: [78.4867, 17.3850] },
    cities: [
      {
        name: 'Hyderabad',
        location: { type: 'Point', coordinates: [78.4867, 17.3850] },
        isPopular: true,
        areas: [
          { name: 'Gachibowli', location: { type: 'Point', coordinates: [78.3545, 17.4401] }, pincode: '500032' },
          { name: 'Hitech City', location: { type: 'Point', coordinates: [78.3910, 17.4436] }, pincode: '500081' },
          { name: 'Banjara Hills', location: { type: 'Point', coordinates: [78.4353, 17.4123] }, pincode: '500034' },
          { name: 'Kondapur', location: { type: 'Point', coordinates: [78.3578, 17.4727] }, pincode: '500084' }
        ]
      }
    ]
  },
  {
    name: 'Tamil Nadu',
    code: 'TN',
    location: { type: 'Point', coordinates: [80.2707, 13.0827] },
    cities: [
      {
        name: 'Chennai',
        location: { type: 'Point', coordinates: [80.2707, 13.0827] },
        isPopular: true,
        areas: [
          { name: 'T Nagar', location: { type: 'Point', coordinates: [80.2333, 13.0418] }, pincode: '600017' },
          { name: 'Anna Nagar', location: { type: 'Point', coordinates: [80.2088, 13.0850] }, pincode: '600040' },
          { name: 'Velachery', location: { type: 'Point', coordinates: [80.2206, 12.9815] }, pincode: '600042' }
        ]
      }
    ]
  },
  {
    name: 'Delhi',
    code: 'DL',
    location: { type: 'Point', coordinates: [77.1025, 28.7041] },
    cities: [
      {
        name: 'Delhi',
        location: { type: 'Point', coordinates: [77.1025, 28.7041] },
        isPopular: true,
        areas: [
          { name: 'Connaught Place', location: { type: 'Point', coordinates: [77.2183, 28.6315] }, pincode: '110001' },
          { name: 'Dwarka', location: { type: 'Point', coordinates: [77.0330, 28.5921] }, pincode: '110075' },
          { name: 'Rohini', location: { type: 'Point', coordinates: [77.0667, 28.7244] }, pincode: '110085' }
        ]
      }
    ]
  }
];

const seedLocations = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb+srv://penchalagopi7396_db_user:pEm9e3EkcrHRspJX@cluster0.yyocng9.mongodb.net/';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected for seeding');

    // Clear existing
    console.log('Clearing existing data...');
    await State.deleteMany();
    await City.deleteMany();
    await Area.deleteMany();
    console.log('✅ Cleared existing data');

    console.log('Seeding locations...');

    for (const stateData of locationData) {
      // Create State with location
      const state = await State.create({
        name: stateData.name,
        code: stateData.code,
        location: stateData.location // GeoJSON format
      });
      console.log(`✅ Created state: ${state.name}`);

      for (const cityData of stateData.cities) {
        // Create City with location
        const city = await City.create({
          name: cityData.name,
          state: state._id,
          stateName: state.name,
          location: cityData.location, // GeoJSON format
          isPopular: cityData.isPopular || false
        });
        console.log(`  ✅ Created city: ${city.name}`);

        // Create Areas with location
        for (const areaData of cityData.areas) {
          await Area.create({
            name: areaData.name,
            displayName: areaData.name,
            city: city._id,
            cityName: city.name,
            state: state._id,
            stateName: state.name,
            location: areaData.location, // GeoJSON format
            pincode: areaData.pincode,
            isPopular: Math.random() > 0.7
          });
        }
        console.log(`     ✅ Created ${cityData.areas.length} areas`);

        // Update city count
        await City.findByIdAndUpdate(city._id, {
          totalAreas: cityData.areas.length
        });
      }

      // Update state count
      await State.findByIdAndUpdate(state._id, {
        totalCities: stateData.cities.length
      });
    }

    // Verify
    const stateCount = await State.countDocuments();
    const cityCount = await City.countDocuments();
    const areaCount = await Area.countDocuments();

    console.log('\n📊 Seeding Complete!');
    console.log(`   States: ${stateCount}`);
    console.log(`   Cities: ${cityCount}`);
    console.log(`   Areas: ${areaCount}`);

    // Test geospatial query
    const testResult = await Area.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [77.5946, 12.9716] // Bangalore
          },
          $maxDistance: 10000 // 10km
        }
      }
    }).limit(5);
    
    console.log(`\n🧪 Test: Found ${testResult.length} areas near Bangalore`);
    if (testResult.length > 0) {
      console.log('   Sample:', testResult[0].name, testResult[0].location);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

seedLocations();