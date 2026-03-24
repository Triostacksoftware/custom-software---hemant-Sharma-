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

//endpoint to place a bid
router.post('/user/bid/place', authentication.isMember, userController.placeBid);

//endpoint to confirm a transaction
router.post('/user/transaction/confirm', authentication.isMember, userController.confirmTransaction);

//endpoint to get the list of active employees
router.get('/member/get_employees', authentication.isMember, userController.getEmployeesForMember);

//endpoint to fetch overall transaction history (pagination allowed)
router.get('/user/transactions', authentication.isMember, userController.getTransactionHistory);


module.exports = router;