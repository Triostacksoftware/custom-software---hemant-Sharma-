const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.js");
const authentication = require("../middleware/authentication.js");


//endpoint for new user registration
router.post('/user/signup/', userController.userSignup);

//endpoint for user login
router.post('/user/login/', userController.userLogin);

//endpoint to fetch user dashboard data
router.get('/user/dashboard', authentication.isMember, userController.getDashboardStats);

//endpoint to fetch unread notification count
router.get('/user/notifications/unread-count', authentication.isMember, userController.getUnreadNotificationCount);

//endpoint to fetch notifications
router.get('/user/notifications', authentication.isMember, userController.getNotifications);

//endpoint to fetch active ad for dashboard
router.get('/user/ads/active', authentication.isMember, userController.getActiveAd);

//endpoint to get the list of groups
router.get('/user/groups', authentication.isMember, userController.getGroups);

//endpoint to request to join a group
router.post('/user/groups/:groupId/join', authentication.isMember, userController.requestToJoinGroup);

//endpoint to fetch group wise user data
router.get('/user/groups/:groupId', authentication.isMember, userController.getGroupDetails);

//endpoint to fetch summary of all current bidding rounds across member's groups
router.get('/user/bidding/dashboard', authentication.isMember, userController.getBiddingDashboard);

//endpoint to fetch rules + existing bids for a specific live bidding room
router.get('/user/bidding/room/:roundId', authentication.isMember, userController.getBiddingRoom);

//endpoint to place a bid
router.post('/user/bid/place', authentication.isMember, userController.placeBid);

//endpoint to confirm a transaction
router.post('/user/transaction/confirm', authentication.isMember, userController.confirmTransaction);

//endpoint to get the list of active employees
router.get('/member/get_employees', authentication.isMember, userController.getEmployeesForMember);

//endpoint to fetch overall transaction history (pagination allowed)
router.get('/user/transactions', authentication.isMember, userController.getTransactionHistory);

//endpoint to fetch per-group pending dues for the raise request page
router.get('/user/requests/pending-dues', authentication.isMember, userController.getPendingDues);

//endpoint to save push subscription object
router.post('/user/push-subscription', authentication.isMember, userController.savePushSubscription);

//endpoint to raise a payment collection or payout request
router.post('/user/requests/raise', authentication.isMember, userController.raisePaymentRequest);


module.exports = router;