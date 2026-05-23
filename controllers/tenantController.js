    // controllers/tenantController.js
const Tenants = require('../models/tenants')
const User = require('../models/authUser');
const Property = require('../models/Property');
const Room = require('../models/roomSchema');
const crypto = require('crypto');
const { sendSMS } = require('../utils/smsService');
const { sendEmail } = require('../utils/emailService');
const { sendPushNotification } = require('../utils/pushNotificationService');

// ==========================================
// 🔧 HELPER FUNCTIONS
// ==========================================

function generateTempPassword(length = 8) {
  return crypto.randomBytes(length).toString('base64').slice(0, length).replace(/[^a-zA-Z0-9]/g, '9');
}

function formatCurrency(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

// ==========================================
// 📋 GET ALL TENANTS
// ==========================================
exports.getAllTenants = async (req, res) => {
  try {
    const { hostelId, status, search, page = 1, limit = 50 } = req.query;
    
    let query = {};
    
    if (hostelId) query.hostelId = hostelId;
    if (status) query.status = status;
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { roomNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tenants, total] = await Promise.all([
      Tenants.find(query)
        .populate('hostelId', 'name address')
        .populate('userId', 'name email phone profileImage')
        .populate('room', 'roomNumber floor')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Tenants.countDocuments(query)
    ]);

    // Add computed fields
    const formattedTenants = tenants.map(t => ({
      ...t,
      daysOverdue: t.nextPaymentDate ? 
        Math.max(0, Math.floor((new Date() - new Date(t.nextPaymentDate)) / (1000 * 60 * 60 * 24))) : 0,
      isOverdue: t.nextPaymentDate ? new Date() > new Date(t.nextPaymentDate) : false
    }));

    res.json({
      success: true,
      tenants: formattedTenants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ==========================================
// 🔍 SEARCH TENANTS
// ==========================================
exports.searchTenants = async (req, res) => {
  try {
    const { q, hostelId } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    let searchQuery = {
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ],
    };

    if (hostelId) searchQuery.hostelId = hostelId;

    const tenants = await Tenants.find(searchQuery)
      .populate('hostelId', 'name')
      .populate('userId', 'name email phone')
      .limit(20);

    res.json({ success: true, tenants, count: tenants.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 📱 CHECK PHONE EXISTS
// ==========================================
exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const user = await User.findOne({ phone: phone.trim() })
      .select('name email phone studentProfiles');

    res.json({
      success: true,
      exists: !!user,
      user: user ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        existingHostels: user.studentProfiles?.length || 0
      } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 👤 GET SINGLE TENANT
// ==========================================
exports.getTenantById = async (req, res) => {
  try {
    const tenant = await Tenants.findById(req.params.id)
      .populate('hostelId', 'name address amenities')
      .populate('userId', 'name email phone profileImage')
      .populate('room', 'roomNumber floor amenities beds');

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Add computed fields
    const tenantObj = tenant.toObject();
    tenantObj.daysOverdue = tenant.daysOverdue;
    tenantObj.daysUntilDue = tenant.daysUntilDue;
    tenantObj.isOverdue = tenant.isOverdue;

    res.json({ success: true, tenant: tenantObj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ➕ CREATE TENANT
// ==========================================
exports.createTenant = async (req, res) => {
  try {
    const {
      name, email, phone, room, roomNumber, bedNumber,
      hostelId, emergencyContact, password,
      monthlyRent = 0, securityDeposit = 0, rentDueDay = 1,
      dateOfBirth, gender, address, course, department,
      notifyUser = true, source = 'direct-admin'
    } = req.body;

    console.log('Creating tenant:', { name, phone, email, hostelId, roomNumber, bedNumber });

    // Validate required fields
    if (!name || !phone || !email || !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, phone, email, hostelId'
      });
    }

    // Check/Create User by PHONE
    let user = await User.findOne({ phone: phone.trim() });
    let isNewUser = false;
    let generatedPassword = null;

    if (!user) {
      isNewUser = true;
      generatedPassword = password || generateTempPassword();
      
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered with different phone number'
        });
      }

      user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: generatedPassword,
        role: 'student',
        isVerified: true,
        createdBy: 'admin'
      });

      await user.save();
      console.log(`✅ New user created: ${user._id}`);
    } else {
      console.log(`👤 Existing user found: ${user._id}`);
    }

    // Check if already tenant in this hostel
    const existingTenant = await Tenants.findOne({ 
      userId: user._id, 
      hostelId: hostelId,
      status: { $in: ['active', 'suspended'] }
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'This user is already a tenant in your hostel',
        existingTenantId: existingTenant._id
      });
    }

    // Room + Bed Assignment
    let assignedRoomId = null, assignedRoomNumber = null;
    let assignedBedId = null, assignedBedNumber = null;

    if (room || roomNumber) {
      let roomQuery = { hostel: hostelId };
      if (room) roomQuery._id = room;
      else if (roomNumber) roomQuery.roomNumber = roomNumber;

      const foundRoom = await Room.findOne(roomQuery);
      if (!foundRoom) {
        return res.status(400).json({ success: false, message: 'Room not found' });
      }

      assignedRoomId = foundRoom._id;
      assignedRoomNumber = foundRoom.roomNumber;

      if (bedNumber) {
        const foundBed = foundRoom.beds.find(b => b.bedNumber === bedNumber);
        if (!foundBed) {
          return res.status(400).json({ 
            success: false, 
            message: `Bed ${bedNumber} not found in room ${foundRoom.roomNumber}` 
          });
        }
        if (foundBed.isOccupied) {
          return res.status(400).json({ 
            success: false, 
            message: `Bed ${bedNumber} is already occupied` 
          });
        }

        foundBed.isOccupied = true;
        foundBed.status = 'occupied';
        assignedBedId = foundBed._id;
        assignedBedNumber = foundBed.bedNumber;
        await foundRoom.save();
      }
    }

    // Set initial payment date (next month from today or check-in)
    const nextPayment = new Date();
    nextPayment.setDate(rentDueDay);
    if (nextPayment < new Date()) {
      nextPayment.setMonth(nextPayment.getMonth() + 1);
    }

    // Create Tenant
    const tenant = new Tenants({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      room: assignedRoomId,
      roomNumber: assignedRoomNumber,
      bedId: assignedBedId,
      bedNumber: assignedBedNumber,
      hostelId,
      userId: user._id,
      monthlyRent,
      securityDeposit,
      rentDueDay,
      nextPaymentDate: nextPayment,
      emergencyContact: emergencyContact || {},
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      address: address || null,
      course: course || null,
      department: department || null,
      hasLoginAccess: true,
      status: 'active',
      source,
      createdBy: 'admin',
      checkInDate: assignedRoomId ? new Date() : null
    });

    await tenant.save();

    // Add to user's student profiles
    await User.findByIdAndUpdate(user._id, {
      $addToSet: { studentProfiles: tenant._id }
    });

    const responseData = {
      success: true,
      message: isNewUser ? 'New user created and tenant added' : 'Existing user linked and tenant added',
      tenant: await Tenants.findById(tenant._id)
        .populate('userId', 'name email phone')
        .populate('room', 'roomNumber floor'),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    };

    if (isNewUser) responseData.temporaryPassword = generatedPassword;

    res.status(201).json(responseData);

  } catch (error) {
    console.error('Create tenant error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry: This user is already a tenant in this hostel'
      });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ==========================================
// ✏️ UPDATE TENANT
// ==========================================
exports.updateTenant = async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    
    // Prevent updating critical fields directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.userId;
    delete updateData.hostelId;
    delete updateData.paymentHistory; // Use recordPayment instead

    const tenant = await Tenants.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('userId', 'name email phone')
    .populate('hostelId', 'name')
    .populate('room', 'roomNumber');

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ❌ DELETE TENANT (Soft Delete)
// ==========================================
exports.deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenants.findByIdAndUpdate(
      req.params.id,
      { status: 'checked-out', checkOutDate: new Date() },
      { new: true }
    );

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Free up the bed
    if (tenant.room && tenant.bedId) {
      await Room.findOneAndUpdate(
        { _id: tenant.room, 'beds._id': tenant.bedId },
        { $set: { 'beds.$.isOccupied': false, 'beds.$.status': 'available' } }
      );
    }

    // Remove from user's studentProfiles
    if (tenant.userId) {
      await User.findByIdAndUpdate(tenant.userId, {
        $pull: { studentProfiles: tenant._id }
      });
    }

    res.json({ success: true, message: 'Tenant checked out successfully', tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 💰 RECORD PAYMENT
// ==========================================
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMode = 'cash', transactionId, notes, paidDate = new Date() } = req.body;
    const ownerId = req.user?._id || req.body.recordedBy;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }

    const tenant = await Tenants.findById(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Add payment to history
    tenant.paymentHistory.push({
      amount,
      paidDate,
      paymentMode,
      transactionId,
      notes,
      recordedBy: ownerId
    });

    // Update financial fields
    tenant.lastPaymentDate = paidDate;
    tenant.totalPaid += amount;
    tenant.pendingAmount = Math.max(0, tenant.pendingAmount - amount);

    // Calculate next payment date
    const nextPayment = new Date(tenant.nextPaymentDate || new Date());
    nextPayment.setMonth(nextPayment.getMonth() + 1);
    tenant.nextPaymentDate = nextPayment;

    await tenant.save();

    // Send payment confirmation
    try {
      await sendSMS({
        to: tenant.phone,
        message: `Hi ${tenant.name}, we received your payment of ${formatCurrency(amount)} for ${tenant.hostelId.name}. Next due: ${nextPayment.toLocaleDateString('en-IN')}. Thank you!`
      });
    } catch (err) {
      console.log('SMS failed:', err.message);
    }

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      tenant: await Tenants.findById(id)
        .populate('hostelId', 'name')
        .populate('userId', 'name email phone')
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 📊 GET PAYMENT HISTORY
// ==========================================
exports.getPaymentHistory = async (req, res) => {
  try {
    const tenant = await Tenants.findById(req.params.id)
      .select('paymentHistory name monthlyRent')
      .populate('paymentHistory.recordedBy', 'name');

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({
      success: true,
      tenantName: tenant.name,
      monthlyRent: tenant.monthlyRent,
      totalPayments: tenant.paymentHistory.length,
      totalPaid: tenant.paymentHistory.reduce((sum, p) => sum + p.amount, 0),
      history: tenant.paymentHistory.sort((a, b) => b.paidDate - a.paidDate)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🔔 GET DUE TENANTS (For Reminders)
// ==========================================
exports.getDueTenants = async (req, res) => {
  try {
    const { hostelId, overdueOnly = false, daysBeforeDue = 3 } = req.query;
    const ownerId = req.user._id;

    // Get hostels owned by this user
    const properties = await Property.find({ owner: ownerId });
    const propertyIds = properties.map(p => p._id.toString());

    // Build query
    const query = {
      status: 'active',
      autoReminderEnabled: true,
      hostelId: hostelId ? mongoose.Types.ObjectId(hostelId) : { $in: propertyIds }
    };

    const now = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + parseInt(daysBeforeDue));

    if (overdueOnly === 'true') {
      query.nextPaymentDate = { $lt: now };
    } else {
      query.$or = [
        { nextPaymentDate: { $lte: reminderDate } },
        { nextPaymentDate: { $lt: now } }
      ];
    }

    const tenants = await Tenants.find(query)
      .populate('userId', 'name email phone profileImage fcmToken')
      .populate('hostelId', 'name location')
      .populate('room', 'roomNumber')
      .sort({ nextPaymentDate: 1 });

    // Format with computed fields
    const formattedTenants = tenants.map(t => {
      const nextPayment = new Date(t.nextPaymentDate);
      const daysDiff = Math.floor((now - nextPayment) / (1000 * 60 * 60 * 24));
      
      return {
        _id: t._id,
        name: t.name,
        email: t.email,
        phone: t.phone,
        user: t.userId,
        hostel: t.hostelId,
        room: t.room,
        bedNumber: t.bedNumber,
        monthlyRent: t.monthlyRent,
        pendingAmount: t.pendingAmount,
        nextPaymentDate: t.nextPaymentDate,
        lastPaymentDate: t.lastPaymentDate,
        lastReminderSent: t.lastReminderSent,
        reminderCount: t.reminderCount,
        daysOverdue: daysDiff > 0 ? daysDiff : 0,
        daysUntilDue: daysDiff <= 0 ? Math.abs(daysDiff) : 0,
        isOverdue: daysDiff > 0,
        reminderPreference: t.reminderPreference,
        canSendSMS: !!t.userId?.phone || !!t.phone,
        canSendEmail: !!t.userId?.email || !!t.email,
        canSendPush: !!t.userId?.fcmToken
      };
    });

    // Calculate summary
    const summary = {
      totalDue: formattedTenants.length,
      totalAmount: formattedTenants.reduce((sum, t) => sum + t.monthlyRent + t.pendingAmount, 0),
      overdueCount: formattedTenants.filter(t => t.isOverdue).length,
      totalOverdueAmount: formattedTenants
        .filter(t => t.isOverdue)
        .reduce((sum, t) => sum + t.monthlyRent + t.pendingAmount, 0)
    };

    res.json({
      success: true,
      summary,
      tenants: formattedTenants
    });
  } catch (error) {
    console.error('Get due tenants error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 📨 SEND SINGLE REMINDER
// ==========================================
exports.sendReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, channels = ['sms', 'email'], customAmount } = req.body;
    const ownerId = req.user._id;

    const tenant = await Tenants.findById(id)
      .populate('userId', 'name email phone fcmToken')
      .populate('hostelId', 'name');

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Verify ownership
    const property = await Property.findOne({ _id: tenant.hostelId, owner: ownerId });
    if (!property) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const amount = customAmount || (tenant.monthlyRent + tenant.pendingAmount);
    const personalizedMsg = message
      ? message
        .replace(/{name}/g, tenant.name)
        .replace(/{amount}/g, formatCurrency(amount))
        .replace(/{hostel}/g, tenant.hostelId.name)
        .replace(/{room}/g, tenant.roomNumber || 'N/A')
        .replace(/{dueDate}/g, tenant.nextPaymentDate?.toLocaleDateString('en-IN') || 'N/A')
      : `Hi ${tenant.name}, your rent ${formatCurrency(amount)} for ${tenant.hostelId.name} (Room ${tenant.roomNumber || 'N/A'}) is due. Please pay by ${tenant.nextPaymentDate?.toLocaleDateString('en-IN') || 'ASAP'}. Thank you!`;

    const results = [];

    // Send SMS
    if (channels.includes('sms')) {
      try {
        await sendSMS({
          to: tenant.userId?.phone || tenant.phone,
          message: personalizedMsg
        });
        results.push({ channel: 'sms', status: 'sent' });
      } catch (err) {
        results.push({ channel: 'sms', status: 'failed', error: err.message });
      }
    }

    // Send Email
    if (channels.includes('email')) {
      try {
        await sendEmail({
          to: tenant.userId?.email || tenant.email,
          subject: `Rent Payment Reminder - ${tenant.hostelId.name}`,
          template: 'rentReminder',
          data: {
            tenantName: tenant.name,
            amount: formatCurrency(amount),
            hostelName: tenant.hostelId.name,
            roomNumber: tenant.roomNumber,
            dueDate: tenant.nextPaymentDate?.toLocaleDateString('en-IN'),
            message: personalizedMsg
          }
        });
        results.push({ channel: 'email', status: 'sent' });
      } catch (err) {
        results.push({ channel: 'email', status: 'failed', error: err.message });
      }
    }

    // Send Push Notification
    if (channels.includes('push') && tenant.userId?.fcmToken) {
      try {
        await sendPushNotification({
          token: tenant.userId.fcmToken,
          title: 'Rent Payment Due',
          body: `Your rent ${formatCurrency(amount)} is due for ${tenant.hostelId.name}`,
          data: { type: 'rent_reminder', tenantId: tenant._id, amount }
        });
        results.push({ channel: 'push', status: 'sent' });
      } catch (err) {
        results.push({ channel: 'push', status: 'failed', error: err.message });
      }
    }

    // Update tenant with reminder
    await tenant.addReminder({
      message: personalizedMsg,
      channels: results.filter(r => r.status === 'sent').map(r => r.channel),
      amount,
      status: results.some(r => r.status === 'sent') ? 'sent' : 'failed',
      sentBy: ownerId
    });

    res.json({
      success: true,
      message: 'Reminder processed',
      data: {
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          reminderCount: tenant.reminderCount
        },
        message: personalizedMsg,
        results
      }
    });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reminder' });
  }
};

// ==========================================
// 📨 SEND BULK REMINDERS
// ==========================================
exports.sendBulkReminders = async (req, res) => {
  try {
    const { tenantIds, message, channels = ['sms', 'email'] } = req.body;
    const ownerId = req.user._id;

    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Tenant IDs required' });
    }

    // Verify all tenants belong to this owner
    const tenants = await Tenants.find({
      _id: { $in: tenantIds },
      status: 'active'
    }).populate('userId', 'name email phone fcmToken')
      .populate('hostelId', 'name owner');

    // Check ownership
    const unauthorized = tenants.filter(t => t.hostelId.owner.toString() !== ownerId.toString());
    if (unauthorized.length > 0) {
      return res.status(403).json({ 
        success: false, 
        message: `Not authorized for ${unauthorized.length} tenant(s)` 
      });
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < tenants.length; i += batchSize) {
      const batch = tenants.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (tenant) => {
        try {
          const amount = tenant.monthlyRent + tenant.pendingAmount;
          const personalizedMsg = message
            ? message
              .replace(/{name}/g, tenant.name)
              .replace(/{amount}/g, formatCurrency(amount))
              .replace(/{hostel}/g, tenant.hostelId.name)
              .replace(/{room}/g, tenant.roomNumber || 'N/A')
            : `Hi ${tenant.name}, your rent ${formatCurrency(amount)} for ${tenant.hostelId.name} is due. Please pay immediately.`;

          const sentChannels = [];

          if (channels.includes('sms') && (tenant.userId?.phone || tenant.phone)) {
            try {
              await sendSMS({ to: tenant.userId?.phone || tenant.phone, message: personalizedMsg });
              sentChannels.push('sms');
            } catch (e) { /* ignore */ }
          }

          if (channels.includes('email') && (tenant.userId?.email || tenant.email)) {
            try {
              await sendEmail({
                to: tenant.userId?.email || tenant.email,
                subject: 'Rent Payment Reminder',
                template: 'rentReminder',
                data: { tenantName: tenant.name, amount: formatCurrency(amount), hostelName: tenant.hostelId.name }
              });
              sentChannels.push('email');
            } catch (e) { /* ignore */ }
          }

          if (channels.includes('push') && tenant.userId?.fcmToken) {
            try {
              await sendPushNotification({
                token: tenant.userId.fcmToken,
                title: 'Rent Payment Due',
                body: `Rent ${formatCurrency(amount)} due for ${tenant.hostelId.name}`
              });
              sentChannels.push('push');
            } catch (e) { /* ignore */ }
          }

          // Add reminder record
          await tenant.addReminder({
            message: personalizedMsg,
            channels: sentChannels,
            amount,
            status: sentChannels.length > 0 ? 'sent' : 'failed',
            sentBy: ownerId
          });

          results.push({ tenantId: tenant._id, name: tenant.name, status: 'success', channels: sentChannels });
          successCount++;
        } catch (err) {
          results.push({ tenantId: tenant._id, name: tenant.name, status: 'failed', error: err.message });
          failedCount++;
        }
      }));
    }

    res.json({
      success: true,
      message: `Reminders: ${successCount} sent, ${failedCount} failed`,
      data: { total: tenants.length, successCount, failedCount, results }
    });
  } catch (error) {
    console.error('Bulk reminder error:', error);
    res.status(500).json({ success: false, message: 'Failed to send bulk reminders' });
  }
};

// ==========================================
// 📜 GET REMINDER HISTORY
// ==========================================
exports.getReminderHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user._id;

    const tenant = await Tenants.findById(id)
      .populate('hostelId', 'owner')
      .populate('remindersSent.sentBy', 'name');

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Verify ownership
    if (tenant.hostelId.owner.toString() !== ownerId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({
      success: true,
      tenant: {
        _id: tenant._id,
        name: tenant.name
      },
      totalReminders: tenant.reminderCount,
      reminders: tenant.remindersSent.sort((a, b) => b.sentAt - a.sentAt)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🔗 LINK USER TO TENANT
// ==========================================
exports.linkUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const [tenant, user] = await Promise.all([
      Tenants.findById(id),
      User.findById(userId)
    ]);

    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    tenant.userId = userId;
    tenant.hasLoginAccess = true;
    await tenant.save();

    await User.findByIdAndUpdate(userId, {
      $addToSet: { studentProfiles: id }
    });

    res.json({
      success: true,
      message: 'User linked to tenant successfully',
      tenant: await Tenants.findById(id).populate('userId', 'name email phone')
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 📊 GET TENANT STATS
// ==========================================
exports.getTenantStats = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const ownerId = req.user._id;

    const matchStage = { status: 'active' };
    if (hostelId) matchStage.hostelId = mongoose.Types.ObjectId(hostelId);

    const stats = await Tenants.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalActive: { $sum: 1 },
          totalMonthlyRent: { $sum: '$monthlyRent' },
          totalPending: { $sum: '$pendingAmount' },
          totalSecurityDeposit: { $sum: '$securityDeposit' },
          avgReminderCount: { $avg: '$reminderCount' }
        }
      }
    ]);

    // Get overdue count
    const overdueQuery = {
      status: 'active',
      nextPaymentDate: { $lt: new Date() }
    };
    if (hostelId) overdueQuery.hostelId = mongoose.Types.ObjectId(hostelId);

    const overdueCount = await Tenants.countDocuments(overdueQuery);

    res.json({
      success: true,
      stats: {
        ...stats[0],
        totalOverdue: overdueCount,
        collectionRate: stats[0] ? 
          ((stats[0].totalMonthlyRent - stats[0].totalPending) / stats[0].totalMonthlyRent * 100).toFixed(2) + '%' 
          : '0%'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};