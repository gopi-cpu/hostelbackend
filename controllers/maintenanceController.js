// controllers/maintenanceController.js
const Maintenance = require('../models/Maintenance');
const Hostel = require('../models/hostelschema');
const Student = require('../models/student');
const User = require('../models/authUser');
const asyncHandler = require('express-async-handler');

// @desc    Create new maintenance request
// @route   POST /api/maintenance
// @access  Private (Student/Admin)
// @desc    Create new maintenance request
// @route   POST /api/maintenance
// @access  Private (Student/Admin)
const createMaintenanceRequest = asyncHandler(async (req, res) => {
  const { hostelId, room, bed, category, title, description, priority, images } = req.body;
  console.log('hostelid', hostelId, req.user._id);
  
  // Verify hostel exists
  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    res.status(404);
    throw new Error('Hostel not found');
  }

  // Check if user is authorized
  const isAuthorized = req.user.role === 'admin' || 
                       req.user.role === 'owner' ||
                       req.user.role === 'staff' ||
                       await Student.findOne({ userId: req.user._id, hostelId });

  if (!isAuthorized) {
    res.status(403);  
    throw new Error('Not authorized to create maintenance request for this hostel');
  }

  // Map priority to match schema enum (Capitalized)
  const priorityMap = {
    'low': 'Low',
    'medium': 'Medium', 
    'high': 'High',
    'emergency': 'Urgent'
  };

  const maintenance = await Maintenance.create({
    hostel: hostelId,
    room,
    bed: bed || null,
    raisedBy: req.user._id,
    category,
    title: title || 'Maintenance Request', // Provide default if missing
    description,
    priority: priorityMap[priority?.toLowerCase()] || 'Medium', // Map to capitalized
    images: images || [],
    status: 'pending'
  });

  const populatedMaintenance = await Maintenance.findById(maintenance._id)
    .populate('raisedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('hostel', 'name');

  res.status(201).json({
    success: true,
    data: populatedMaintenance
  });
});
// @desc    Get all maintenance requests for a hostel
// @route   GET /api/maintenance/hostel/:hostelId
// @access  Private (Admin/Owner/Staff)
const getHostelMaintenanceRequests = asyncHandler(async (req, res) => {
  const { hostelId } = req.params;
  const { status, priority, category } = req.query;

  // Build query
  let query = { hostel: hostelId };

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;

  // Check authorization
  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    res.status(404);
    throw new Error('Hostel not found');
  }

  if (req.user.role !== 'admin' && 
      req.user.role !== 'owner' && 
      req.user.role !== 'staff' &&
      hostel.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized');
  }

  const requests = await Maintenance.find(query)
    .populate('raisedBy', 'name email phone')
    .populate('assignedTo', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: requests.length,
    data: requests
  });
});

// @desc    Get maintenance requests raised by current user
// @route   GET /api/maintenance/my-requests
// @access  Private
const getMyMaintenanceRequests = asyncHandler(async (req, res) => {
  console.log('maintanance log ')
  const requests = await Maintenance.find({ raisedBy: req.user._id })
    .populate('hostel', 'name address')
    .populate('assignedTo', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    count: requests.length,
    data: requests
  });
});

// @desc    Get single maintenance request
// @route   GET /api/maintenance/:id
// @access  Private
const getMaintenanceRequest = asyncHandler(async (req, res) => {
  const maintenance = await Maintenance.findById(req.params.id)
    .populate('raisedBy', 'name email phone')
    .populate('assignedTo', 'name email phone')
    .populate('hostel', 'name address contact');

  if (!maintenance) {
    res.status(404);
    throw new Error('Maintenance request not found');
  }

  // Check authorization
  if (maintenance.raisedBy._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' && 
      req.user.role !== 'owner' && 
      req.user.role !== 'staff') {
    res.status(403);
    throw new Error('Not authorized');
  }

  res.json({
    success: true,
    data: maintenance
  });
});

// @desc    Update maintenance request status
// @route   PUT /api/maintenance/:id/status
// @access  Private (Admin/Owner/Staff)
const updateMaintenanceStatus = asyncHandler(async (req, res) => {
  const { status, assignedTo, estimatedCost, actualCost, completionDate } = req.body;

  const maintenance = await Maintenance.findById(req.params.id);

  if (!maintenance) {
    res.status(404);
    throw new Error('Maintenance request not found');
  }

  if (req.user.role !== 'admin' && 
      req.user.role !== 'owner' && 
      req.user.role !== 'staff') {
    res.status(403);
    throw new Error('Not authorized to update maintenance status');
  }

  // Validate status against schema enum
  const validStatuses = ['pending', 'in-progress', 'resolved', 'closed'];
  if (status && !validStatuses.includes(status)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  maintenance.status = status || maintenance.status;
  
  if (assignedTo) maintenance.assignedTo = assignedTo;
  if (estimatedCost) maintenance.estimatedCost = estimatedCost;
  if (actualCost) maintenance.actualCost = actualCost;
  if (completionDate) maintenance.completionDate = completionDate;

  await maintenance.save();

  const updatedMaintenance = await Maintenance.findById(maintenance._id)
    .populate('raisedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('hostel', 'name');

  res.json({
    success: true,
    data: updatedMaintenance
  });
});

// @desc    Assign maintenance request to staff
// @route   PUT /api/maintenance/:id/assign
// @access  Private (Admin/Owner)
const assignMaintenanceRequest = asyncHandler(async (req, res) => {
  const { staffId } = req.body;

  const maintenance = await Maintenance.findById(req.params.id);

  if (!maintenance) {
    res.status(404);
    throw new Error('Maintenance request not found');
  }

  const staff = await User.findById(staffId);
  if (!staff || (staff.role !== 'staff' && staff.role !== 'admin')) {
    res.status(400);
    throw new Error('Invalid staff member');
  }

  maintenance.assignedTo = staffId;
  maintenance.status = 'in-progress'; // Changed from 'in_progress' to 'in-progress'
  await maintenance.save();

  const updatedMaintenance = await Maintenance.findById(maintenance._id)
    .populate('raisedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('hostel', 'name');

  res.json({
    success: true,
    data: updatedMaintenance
  });
});

// @desc    Add feedback to completed maintenance
// @route   PUT /api/maintenance/:id/feedback
// @access  Private (Student who raised it)
const addFeedback = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const maintenance = await Maintenance.findById(req.params.id);

  if (!maintenance) {
    res.status(404);
    throw new Error('Maintenance request not found');
  }

  if (maintenance.raisedBy.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Only the requester can add feedback');
  }

  // Updated to match schema enum values
  if (maintenance.status !== 'resolved' && maintenance.status !== 'closed') {
    res.status(400);
    throw new Error('Can only add feedback to resolved or closed requests');
  }

  maintenance.feedback = {
    rating,
    comment,
    date: new Date()
  };

  await maintenance.save();

  res.json({
    success: true,
    data: maintenance
  });
});

// @desc    Get maintenance statistics for hostel
// @route   GET /api/maintenance/hostel/:hostelId/stats
// @access  Private (Admin/Owner/Staff)
const getMaintenanceStats = asyncHandler(async (req, res) => {
  const { hostelId } = req.params;

  const stats = await Maintenance.aggregate([
    { $match: { hostel: new mongoose.Types.ObjectId(hostelId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const priorityStats = await Maintenance.aggregate([
    { $match: { hostel: new mongoose.Types.ObjectId(hostelId) } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);

  const categoryStats = await Maintenance.aggregate([
    { $match: { hostel: new mongoose.Types.ObjectId(hostelId) } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      statusStats: stats,
      priorityStats: priorityStats,
      categoryStats: categoryStats
    }
  });
});

// @desc    Delete maintenance request
// @route   DELETE /api/maintenance/:id
// @access  Private (Admin only)
const deleteMaintenanceRequest = asyncHandler(async (req, res) => {
  const maintenance = await Maintenance.findById(req.params.id);

  if (!maintenance) {
    res.status(404);
    throw new Error('Maintenance request not found');
  }

  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Only admin can delete maintenance requests');
  }

  await maintenance.deleteOne();

  res.json({
    success: true,
    message: 'Maintenance request deleted'
  });
});


const getOwnerDashboard = asyncHandler(async (req, res) => {
  const { status, priority, category, hostelId, startDate, endDate } = req.query;
  
  const hostels = await Hostel.find({ owner: req.user._id });
  const hostelIds = hostels.map(h => h._id);

  let matchStage = { hostel: { $in: hostelIds } };
  
  if (hostelId && hostels.some(h => h._id.toString() === hostelId)) {
    matchStage.hostel = new mongoose.Types.ObjectId(hostelId);
  }
  if (status) matchStage.status = status;
  if (priority) matchStage.priority = priority;
  if (category) matchStage.category = category;
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const [requests, stats] = await Promise.all([
    Maintenance.find(matchStage)
      .populate('raisedBy', 'name email phone')
      .populate('assignedTo', 'name email phone role')
      .populate('hostel', 'name address city')
      .populate('studentProfile', 'name studentId')
      .sort({ createdAt: -1 })
      .limit(50),

    Maintenance.aggregate([
      { $match: { hostel: { $in: hostelIds } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } }, // Fixed
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }, // Changed from completed
          urgent: { $sum: { $cond: [{ $eq: ['$priority', 'Urgent'] }, 1, 0] } }, // Fixed case
          highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] } } // Fixed case
        }
      }
    ])
  ]);

  const staff = await User.find({
    $or: [
      { role: 'staff' },
      { role: 'admin' }
    ]
  }).select('name email phone role');

  res.json({
    success: true,
    data: {
      requests,
      stats: stats[0] || { total: 0, pending: 0, inProgress: 0, resolved: 0, urgent: 0, highPriority: 0 },
      hostels: hostels.map(h => ({ id: h._id, name: h.name })),
      staff
    }
  });
});

const getRequestDetails = asyncHandler(async (req, res) => {
  const maintenance = await Maintenance.findById(req.params.id)
    .populate('raisedBy', 'name email phone profileImage')
    .populate('assignedTo', 'name email phone role')
    .populate('hostel', 'name address contact')
    .populate('studentProfile', 'name studentId room phone')
    .populate('history.performedBy', 'name role');

  if (!maintenance) {
    res.status(404);
    throw new Error('Maintenance request not found');
  }

  // Verify ownership
  const hostel = await Hostel.findById(maintenance.hostel);
  if (hostel.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized');
  }

  res.json({
    success: true,
    data: maintenance
  });
});


const createOwnerRequest = asyncHandler(async (req, res) => {
  const { hostelId, room, bed, category, title, description, priority, studentId } = req.body;

  const hostel = await Hostel.findOne({ _id: hostelId, owner: req.user._id });
  if (!hostel) {
    res.status(404);
    throw new Error('Hostel not found or not authorized');
  }

  let raisedBy = req.user._id;
  let studentProfile = null;

  if (studentId) {
    const student = await Student.findOne({ _id: studentId, hostelId });
    if (student) {
      raisedBy = student.userId || req.user._id;
      studentProfile = student._id;
    }
  }

  // Map priority to match schema enum
  const priorityMap = {
    'low': 'Low',
    'medium': 'Medium', 
    'high': 'High',
    'emergency': 'Urgent'
  };

  const maintenance = await Maintenance.create({
    hostel: hostelId,
    room,
    bed: bed || null,
    raisedBy,
    studentProfile,
    category,
    title: title || 'Maintenance Request',
    description,
    priority: priorityMap[priority?.toLowerCase()] || 'Medium',
    status: 'pending',
    createdBy: 'owner',
    history: [{
      action: 'created',
      performedBy: req.user._id,
      details: 'Request created by owner'
    }]
  });

  const populated = await Maintenance.findById(maintenance._id)
    .populate('raisedBy', 'name email')
    .populate('hostel', 'name');

  res.status(201).json({
    success: true,
    data: populated
  });
});


const assignStaff = asyncHandler(async (req, res) => {
  const { staffId, estimatedCost, scheduledDate, notes } = req.body;

  const maintenance = await Maintenance.findById(req.params.id);
  if (!maintenance) {
    res.status(404);
    throw new Error('Request not found');
  }

  const hostel = await Hostel.findById(maintenance.hostel);
  if (hostel.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized');
  }

  const staff = await User.findById(staffId);
  if (!staff || (staff.role !== 'staff' && staff.role !== 'admin')) {
    res.status(400);
    throw new Error('Invalid staff member');
  }

  maintenance.assignedTo = staffId;
  maintenance.status = 'in-progress'; // Changed from 'in_progress'
  
  if (estimatedCost) maintenance.estimatedCost = estimatedCost;
  if (scheduledDate) maintenance.scheduledDate = new Date(scheduledDate);
  if (notes) {
    maintenance.internalNotes.push({
      note: notes,
      addedBy: req.user._id
    });
  }
  
  maintenance.history.push({
    action: 'assigned',
    performedBy: req.user._id,
    details: `Assigned to ${staff.name}`
  });

  await maintenance.save();

  const updated = await Maintenance.findById(maintenance._id)
    .populate('raisedBy', 'name email phone')
    .populate('assignedTo', 'name email phone')
    .populate('hostel', 'name');

  res.json({
    success: true,
    data: updated
  });
});

const updateRequest = asyncHandler(async (req, res) => {
  const { 
    status, 
    actualCost, 
    completionDate, 
    resolution, 
    materialsUsed,
    internalNotes 
  } = req.body;

  const maintenance = await Maintenance.findById(req.params.id);
  if (!maintenance) {
    res.status(404);
    throw new Error('Request not found');
  }

  const hostel = await Hostel.findById(maintenance.hostel);
  if (hostel.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized');
  }

  // Update fields
  if (status) {
    maintenance.status = status;
    maintenance.history.push({
      action: 'status_change',
      performedBy: req.user._id,
      details: `Status changed to ${status}`
    });
  }
  
  if (actualCost !== undefined) maintenance.actualCost = actualCost;
  if (completionDate) maintenance.completionDate = new Date(completionDate);
  if (resolution) maintenance.resolution = resolution;
  if (materialsUsed) maintenance.materialsUsed = materialsUsed;
  
  if (internalNotes) {
    maintenance.internalNotes.push({
      note: internalNotes,
      addedBy: req.user._id
    });
  }

  await maintenance.save();

  const updated = await Maintenance.findById(maintenance._id)
    .populate('raisedBy', 'name email phone')
    .populate('assignedTo', 'name email phone')
    .populate('hostel', 'name');

  res.json({
    success: true,
    data: updated
  });
});



const getReports = asyncHandler(async (req, res) => {
  const { hostelId, period = 'month' } = req.query;
  
  const hostels = await Hostel.find({ owner: req.user._id });
  const hostelIds = hostelId 
    ? [new mongoose.Types.ObjectId(hostelId)]
    : hostels.map(h => h._id);

  const dateFilter = {};
  const now = new Date();
  if (period === 'week') {
    dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
  } else if (period === 'month') {
    dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
  } else if (period === 'year') {
    dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
  }

  const reports = await Maintenance.aggregate([
    { 
      $match: { 
        hostel: { $in: hostelIds },
        ...(Object.keys(dateFilter).length && { createdAt: dateFilter })
      } 
    },
    {
      $group: {
        _id: {
          status: '$status',
          category: '$category',
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $and: ['$completionDate', '$createdAt'] },
              { $subtract: ['$completionDate', '$createdAt'] },
              null
            ]
          }
        },
        totalCost: { $sum: '$actualCost' }
      }
    }
  ]);

  const categoryBreakdown = await Maintenance.aggregate([
    { $match: { hostel: { $in: hostelIds } } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  const staffPerformance = await Maintenance.aggregate([
    { 
      $match: { 
        hostel: { $in: hostelIds },
        assignedTo: { $exists: true }
      } 
    },
    {
      $group: {
        _id: '$assignedTo',
        completed: { 
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } 
        },
        total: { $sum: 1 },
        avgRating: { $avg: '$feedback.rating' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'staff'
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      trends: reports,
      categories: categoryBreakdown,
      staffPerformance,
      summary: {
        totalRequests: reports.reduce((acc, r) => acc + r.count, 0),
        completedRequests: reports.filter(r => r._id.status === 'completed').reduce((acc, r) => acc + r.count, 0),
        totalSpent: reports.reduce((acc, r) => acc + (r.totalCost || 0), 0)
      }
    }
  });
});

const bulkUpdate = asyncHandler(async (req, res) => {
  const { ids, status, assignedTo } = req.body;

  const updateData = {};
  if (status) updateData.status = status;
  if (assignedTo) updateData.assignedTo = assignedTo;

  await Maintenance.updateMany(
    { _id: { $in: ids } },
    { 
      $set: updateData,
      $push: {
        history: {
          action: 'bulk_update',
          performedBy: req.user._id,
          details: `Bulk update: status=${status}, assignedTo=${assignedTo}`,
          performedAt: new Date()
        }
      }
    }
  );

  res.json({
    success: true,
    message: `${ids.length} requests updated`
  });
});


module.exports = {
  getOwnerDashboard,
  getRequestDetails,
  createOwnerRequest,
  assignStaff,
  updateRequest,
  getReports,
  bulkUpdate,
  createMaintenanceRequest,
  getHostelMaintenanceRequests,
  getMyMaintenanceRequests,
  getMaintenanceRequest,
  updateMaintenanceStatus,
  assignMaintenanceRequest,
  addFeedback,
  getMaintenanceStats,
  deleteMaintenanceRequest
};