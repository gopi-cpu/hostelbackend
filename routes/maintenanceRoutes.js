// routes/maintenanceRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createMaintenanceRequest,
  getHostelMaintenanceRequests,
  getMyMaintenanceRequests,
  getMaintenanceRequest,
  updateMaintenanceStatus,
  assignMaintenanceRequest,
  addFeedback,
  getMaintenanceStats,
  deleteMaintenanceRequest,
   getOwnerDashboard,
  getRequestDetails,
  createOwnerRequest,
  assignStaff,
  updateRequest,
  getReports,
  bulkUpdate
} = require('../controllers/maintenanceController');

// All routes are protected
router.use(protect);
router.use(authorize('owner', 'admin'));

// Student routes
router.post('/', createMaintenanceRequest);
router.get('/my-requests', getMyMaintenanceRequests);
router.get('/:id', getMaintenanceRequest);
router.put('/:id/feedback', addFeedback);

// Admin/Owner/Staff routes
router.get('/hostel/:hostelId', authorize('admin', 'owner', 'staff'), getHostelMaintenanceRequests);
router.get('/hostel/:hostelId/stats', authorize('admin', 'owner', 'staff'), getMaintenanceStats);
router.put('/:id/status', authorize('admin', 'owner', 'staff'), updateMaintenanceStatus);
router.put('/:id/assign', authorize('admin', 'owner'), assignMaintenanceRequest);
router.delete('/:id', authorize('admin'), deleteMaintenanceRequest);

router.get('/owner/dashboard', getOwnerDashboard);
router.get('/owner/reports', getReports);
router.post('/owner/create', createOwnerRequest);
router.get('/:id/details', getRequestDetails);
router.put('/:id/assign', assignStaff);
router.put('/:id/update', updateRequest);
router.put('/bulk-update', bulkUpdate);

module.exports = router;