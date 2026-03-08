// utils/hostelMapper.js

/**
 * Transform backend Property schema to frontend Hostel format
 */
exports.mapPropertyToHostel = (property) => {
  if (!property) return null;

  return {
    _id: property._id,
    name: property.name,
    description: property.description,
    
    // Address mapping
    address: {
      street: property.location?.address?.street || '',
      city: property.location?.address?.city || '',
      state: property.location?.address?.state || '',
      pincode: property.location?.address?.pincode || '',
      country: property.location?.address?.country || 'India',
      coordinates: property.location?.coordinates?.coordinates 
        ? {
            lat: property.location.coordinates.coordinates[1], // MongoDB stores [lng, lat]
            lng: property.location.coordinates.coordinates[0]
          }
        : undefined
    },

    // Contact mapping
    contact: {
      phone: property.contact?.phone || '',
      email: property.contact?.email || '',
      emergencyContact: property.contact?.emergencyContact || '',
      whatsapp: property.contact?.whatsapp || property.contact?.phone || ''
    },

    // Rating mapping
    rating: {
      average: property.rating?.average || 0,
      count: property.rating?.count || 0,
      breakdown: {
        cleanliness: property.rating?.breakdown?.cleanliness || 0,
        food: property.rating?.breakdown?.food || 0,
        safety: property.rating?.breakdown?.safety || 0,
        amenities: property.rating?.breakdown?.amenities || 0,
        location: property.rating?.breakdown?.location || 0,
        value: property.rating?.breakdown?.valueForMoney || 0
      }
    },

    // Billing settings mapping
    billingSettings: {
      monthlyRent: property.pricing?.monthlyRent?.amount || 0,
      securityDeposit: property.pricing?.securityDeposit?.amount || 0,
      maintenanceCharges: property.pricing?.maintenanceCharges?.amount || 0,
      rentDueDate: property.bookingSettings?.advanceBookingDays || 1,
      lateFeePercentage: 5, // Default or add to schema
      paymentMethods: ['Cash', 'UPI', 'Bank Transfer'] // Default or add to schema
    },

    // Owner mapping
    owner: property.owner ? {
      _id: property.owner._id || property.owner,
      name: property.owner.name || 'Hostel Owner',
      email: property.owner.email || '',
      phone: property.owner.phone || property.contact?.phone || '',
      avatar: property.owner.profileImage || property.owner.avatar || ''
    } : {
      _id: '',
      name: 'Hostel Owner',
      email: '',
      phone: property.contact?.phone || '',
      avatar: ''
    },

    // Amenities mapping (already array of strings in your schema ✓)
    amenities: property.amenities || [],

    // Rules mapping - convert from your rules object to array of strings
    rules: property.rules?.general || [
      'No smoking inside premises',
      'No loud music after 10 PM',
      'Visitors allowed in common areas only',
      'ID proof mandatory for all guests'
    ],

    // Images mapping
    images: property.images?.map((img, index) => ({
      _id: img._id || `img_${index}`,
      url: img.url,
      caption: img.caption || '',
      isPrimary: img.isPrimary || index === 0
    })) || [],

    // Approval status
    isApproved: property.verification?.isVerified || false,
    isActive: property.status === 'active',

    // Gender type mapping from subType or propertyType
    genderType: mapGenderType(property.subType, property.propertyType),

    // Room types mapping
    roomTypes: property.unitDetails?.roomType 
      ? [property.unitDetails.roomType] 
      : ['Single', 'Double', 'Triple'],

    createdAt: property.createdAt,
    updatedAt: property.updatedAt
  };
};

// Helper function to determine gender type
function mapGenderType(subType, propertyType) {
  if (subType === 'boys' || subType === 'male') return 'male';
  if (subType === 'girls' || subType === 'female') return 'female';
  if (subType === 'coed' || subType === 'co-ed') return 'co-ed';
  if (subType === 'working_professionals') return 'co-ed';
  
  // Default based on property type
  if (propertyType === 'hostel') return 'co-ed';
  return 'co-ed';
}