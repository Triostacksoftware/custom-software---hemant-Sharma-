const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.js");
const authentication = require("../middleware/authentication.js");

// ============================================================================
// 1. AUTHENTICATION & PUBLIC
// ============================================================================

// Endpoint for admin login
router.post('/admin/login/', adminController.adminLogin);


// ============================================================================
// 2. DASHBOARD
// ============================================================================

// Endpoint to get admin dashboard stats
router.get('/admin/dashboard/stats/', authentication.authenticate, authentication.isAdmin, adminController.getDashboardStats);


// ============================================================================
// 3. GROUP MANAGEMENT
// ============================================================================

// Endpoint to fetch all groups
router.get('/admin/groups/fetch_all', authentication.authenticate, authentication.isAdmin, adminController.getGroups);

// Endpoint to fetch group details
router.get('/admin/group/fetch/group_details/:groupId', authentication.authenticate, authentication.isAdmin, adminController.getGroupDetails);

// Endpoint for group creation
router.post('/admin/create_group/', authentication.authenticate, authentication.isAdmin, adminController.createGroup);

// Endpoint to add new members to a group
router.post('/admin/group/add_member/:groupId', authentication.authenticate, authentication.isAdmin, adminController.addMemberToGroup);

// Endpoint to activate a group
router.post('/admin/group/activate_group/:groupId', authentication.authenticate, authentication.isAdmin, adminController.activateGroup);


// ============================================================================
// 4. USER / MEMBER MANAGEMENT
// ============================================================================

// Endpoint to fetch all members (pagination optional)
router.get('/admin/users/fetch_all', authentication.authenticate, authentication.isAdmin, adminController.getMembers);

// Endpoint to fetch member details
router.get('/admin/users/fetch/details/:userId', authentication.authenticate, authentication.isAdmin, adminController.getMemberDetails);

// Endpoint to fetch pending members awaiting approval
router.get('/admin/users/fetch/pending_user/', authentication.authenticate, authentication.isAdmin, adminController.getPendingUsers);

// Endpoint to approve users
router.post('/admin/users/approve_user/', authentication.authenticate, authentication.isAdmin, adminController.approveUser);

// Endpoint to reject users
router.post('/admin/users/reject_user', authentication.authenticate, authentication.isAdmin, adminController.rejectUser);


// ============================================================================
// 5. EMPLOYEE MANAGEMENT
// ============================================================================

// Endpoint to fetch all employees
router.get('/admin/employees/fetch_all', authentication.authenticate, authentication.isAdmin, adminController.getEmployees);

// Endpoint to fetch pending employees awaiting approval
router.get('/admin/employees/fetch/pending_employee/', authentication.authenticate, authentication.isAdmin, adminController.getPendingEmployees);

// Endpoint to approve employees
router.post('/admin/employees/approve_employee', authentication.authenticate, authentication.isAdmin, adminController.approveEmployee);

// Endpoint to reject employees
router.post('/admin/employees/reject_employee', authentication.authenticate, authentication.isAdmin, adminController.rejectEmployee);

// Endpoint to fetch transaction history logged by a specific employee
router.get('/admin/employees/fetch/history/:employeeId', authentication.authenticate, authentication.isAdmin, adminController.getEmployeeTransactionHistory);

// Endpoint to fetch cash in hand of a specific employee
router.get('/admin/employees/:employeeId/cash-in-hand', authentication.authenticate, authentication.isAdmin, adminController.getEmployeeCashInHand);


// ============================================================================
// 6. BIDDING & AUCTIONS
// ============================================================================

// Endpoint to get current bidding round details for a group
router.get('/admin/bidding/current/:groupId', authentication.authenticate, authentication.isAdmin, adminController.getCurrentBiddingRound);

// Endpoint to get bid details for a specific bidding round
router.get('/admin/bidding/round/:roundId/bids', authentication.authenticate, authentication.isAdmin, adminController.getBidsForRound);

// Endpoint to open bidding for a group
router.post('/admin/bidding/open/', authentication.authenticate, authentication.isAdmin, adminController.openBidding);

// Endpoint to close bidding for a group
router.post('/admin/bidding/close/', authentication.authenticate, authentication.isAdmin, adminController.closeBidding);

// Endpoint to resolve a tie in a bidding round
router.post('/admin/bidding/resolve-tie/', authentication.authenticate, authentication.isAdmin, adminController.resolveTie);

// Endpoint to finalize a bidding round
router.post('/admin/bidding/finalize/', authentication.authenticate, authentication.isAdmin, adminController.finalizeBidding);

// Endpoint to update bid terms
router.patch('/admin/bidding/update-terms/:roundId', authentication.authenticate, authentication.isAdmin, adminController.updateBidTerms);


// ============================================================================
// 7. COLLECTIONS & PAYOUTS
// ============================================================================

// Endpoint to fetch details of pending contributions
router.get('/admin/collections/pending', authentication.authenticate, authentication.isAdmin, adminController.getPendingCollections);

// Endpoint to remind a customer for collection
router.post('/admin/collections/remind', authentication.authenticate, authentication.isAdmin, adminController.sendCollectionReminder);

// Endpoint to fetch the details of pending payouts
router.get('/admin/payouts/pending', authentication.authenticate, authentication.isAdmin, adminController.getPendingPayouts);


// ============================================================================
// 8. ADVERTISEMENTS
// ============================================================================

// Endpoint to fetch all ads
router.get('/admin/ads', authentication.authenticate, authentication.isAdmin, adminController.getAllAds);

// Endpoint to create a new ad
router.post('/admin/ads', authentication.authenticate, authentication.isAdmin, adminController.createAd);

// Endpoint to update an existing ad
router.patch('/admin/ads/:adId', authentication.authenticate, authentication.isAdmin, adminController.updateAd);

// Endpoint to activate an ad
router.patch('/admin/ads/:adId/activate', authentication.authenticate, authentication.isAdmin, adminController.activateAd);

// Endpoint to deactivate an ad
router.patch('/admin/ads/:adId/deactivate', authentication.authenticate, authentication.isAdmin, adminController.deactivateAd);

// Endpoint to delete an ad
router.delete('/admin/ads/:adId', authentication.authenticate, authentication.isAdmin, adminController.deleteAd);


// ============================================================================
// 9. NOTIFICATIONS & PUSH
// ============================================================================

// Endpoint to get unread notifications
router.get('/admin/notifications', authentication.authenticate, authentication.isAdmin, adminController.getNotifications);

// Endpoint to get unread notification count
router.get('/admin/notifications/unread-count', authentication.authenticate, authentication.isAdmin, adminController.getUnreadNotificationCount);

// Endpoint to save push subscription object for notifications
router.post('/admin/push-subscription', authentication.authenticate, authentication.isAdmin, adminController.saveAdminPushSubscription);


module.exports = router;