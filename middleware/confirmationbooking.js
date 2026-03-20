// Add this middleware to check if booking is confirmed
exports.requireConfirmedBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      user: req.user.id,
      status: 'confirmed' // or 'checkedIn'
    });

    if (!booking) {
      // Check if pending booking exists
      const pendingBooking = await Booking.findOne({
        user: req.user.id,
        status: 'pending'
      });

      if (pendingBooking) {
        return res.status(403).json({
          success: false,
          message: 'Booking pending approval. Please wait for owner confirmation.',
          status: 'pending',
          bookingId: pendingBooking._id
        });
      }

      return res.status(404).json({
        success: false,
        message: 'No active booking found'
      });
    }

    req.booking = booking;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


exports.getUserActiveBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      user: req.user.id,
      status: { $in: ['pending', 'confirmed', 'checkedIn'] }
    })
    .populate('hostel', 'name address images owner')
    .populate('room', 'roomNumber floor roomType')
    .lean();

    if (!booking) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No active booking found'
      });
    }

    // Calculate days remaining for checkedIn bookings
    let stayInfo = { daysRemaining: 0, totalDays: null };
    if (booking.status === 'checkedIn' && booking.checkOutDate) {
      const today = new Date();
      const checkOut = new Date(booking.checkOutDate);
      const diffTime = checkOut - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      stayInfo.daysRemaining = diffDays > 0 ? diffDays : 0;
      stayInfo.totalDays = booking.durationMonths * 30;
    }

    // Determine available features based on status
    const features = {
      canMessage: booking.status === 'checkedIn',
      canRaiseMaintenance: booking.status === 'checkedIn',
      canPay: ['pending', 'confirmed', 'checkedIn'].includes(booking.status),
      canViewDocuments: true,
      showPaymentAlert: ['confirmed', 'checkedIn'].includes(booking.status)
    };

    res.status(200).json({
      success: true,
      data: {
        booking,
        pgDetails: booking.hostel,
        stayInfo,
        features,
        nextSteps: getNextSteps(booking.status)
      }
    });
  } catch (error) {
    console.error('Get user booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

const getNextSteps = (status) => {
  const steps = {
    pending: [
      { step: 1, title: 'Owner Review', desc: 'Your booking is under review', completed: true },
      { step: 2, title: 'Confirmation', desc: 'Wait for owner approval', completed: false },
      { step: 3, title: 'Payment', desc: 'Complete security deposit', completed: false },
      { step: 4, title: 'Check-in', desc: 'Access your room', completed: false }
    ],
    confirmed: [
      { step: 1, title: 'Owner Review', desc: 'Booking approved', completed: true },
      { step: 2, title: 'Confirmation', desc: 'Booking confirmed', completed: true },
      { step: 3, title: 'Payment', desc: 'Complete security deposit', completed: false },
      { step: 4, title: 'Check-in', desc: 'Access your room', completed: false }
    ],
    checkedIn: [
      { step: 1, title: 'Owner Review', desc: 'Booking approved', completed: true },
      { step: 2, title: 'Confirmation', desc: 'Booking confirmed', completed: true },
      { step: 3, title: 'Payment', desc: 'Payment completed', completed: true },
      { step: 4, title: 'Check-in', desc: 'Checked in successfully', completed: true }
    ]
  };
  return steps[status] || steps.pending;
};