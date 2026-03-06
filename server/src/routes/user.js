const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.js");
const authentication = require("../middleware/authentication.js");


//endpoint for new user registration
router.post('/user/signup/', userController.userSignup);

//endpoint for user login
router.post('/user/login/', userController.userLogin);

//endpoint to fetch user dashboard data
router.get('/user/dashboard', authentication.isMember, userController.getUserDashboard);

//endpoint to fetch group wise user data
router.get('/user/groups/:groupId', authentication.isMember, userController.getGroupDetails);

//endpoint to place a bid
router.post('/user/bid/place', authentication.isMember, userController.placeBid);

//endpoint to confirm a transaction
router.post('/user/transaction/confirm', authentication.isMember, userController.confirmTransaction);


module.exports = router;