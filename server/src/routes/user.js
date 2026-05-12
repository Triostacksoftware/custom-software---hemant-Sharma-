const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.js");
const authentication = require("../middleware/authentication.js");

// ============================================================================
// 1. AUTHENTICATION & PUBLIC
// ============================================================================

// Endpoint for new user registration
router.post('/user/signup/', userController.userSignup);

// Endpoint for user login
router.post('/user/login/', userController.userLogin);


// ============================================================================
// 2. DASHBOARD & OVERVIEW
// ============================================================================

// Endpoint to fetch user dashboard data/stats
router.get('/user/dashboard', authentication.isMember, userController.getDashboardStats);

// Endpoint to fetch active ad for the dashboard
router.get('/user/ads/active', authentication.isMember, userController.getActiveAd);


// ============================================================================
// 3. GROUPS & DIRECTORY
// ============================================================================

// Endpoint to get the list of all available groups
router.get('/user/groups', authentication.isMember, userController.getGroups);

// Endpoint to request to join a specific group
router.post('/user/groups/:groupId/join', authentication.isMember, userController.requestToJoinGroup);

// Endpoint to fetch group-wise user data and details
router.get('/user/groups/:groupId', authentication.isMember, userController.getGroupDetails);

// Endpoint to get the list of active employees (for member reference/contact)
router.get('/member/get_employees', authentication.isMember, userController.getEmployeesForMember);


// ============================================================================
// 4. BIDDING & AUCTIONS
// ============================================================================

// Endpoint to fetch summary of all current bidding rounds across the member's groups
router.get('/user/bidding/dashboard', authentication.isMember, userController.getBiddingDashboard);

// Endpoint to fetch rules and existing bids for a specific live bidding room
router.get('/user/bidding/room/:roundId', authentication.isMember, userController.getBiddingRoom);

// Endpoint to place a new bid in an active round
router.post('/user/bid/place', authentication.isMember, userController.placeBid);


// ============================================================================
// 5. TRANSACTIONS & REQUESTS
// ============================================================================

// Endpoint to fetch per-group pending dues for the raise request page
router.get('/user/requests/pending-dues', authentication.isMember, userController.getPendingDues);

// Endpoint to raise a payment collection or payout request
router.post('/user/requests/raise', authentication.isMember, userController.raisePaymentRequest);

// Endpoint to confirm a pending transaction
router.post('/user/transaction/confirm', authentication.isMember, userController.confirmTransaction);

// Endpoint to fetch overall transaction history (supports pagination)
router.get('/user/transactions', authentication.isMember, userController.getTransactionHistory);


// ============================================================================
// 6. NOTIFICATIONS & PUSH
// ============================================================================

// Endpoint to fetch all notifications
router.get('/user/notifications', authentication.isMember, userController.getNotifications);

// Endpoint to fetch unread notification count
router.get('/user/notifications/unread-count', authentication.isMember, userController.getUnreadNotificationCount);

// Endpoint to save push subscription object for web push notifications
router.post('/user/push-subscription', authentication.isMember, userController.savePushSubscription);


module.exports = router;