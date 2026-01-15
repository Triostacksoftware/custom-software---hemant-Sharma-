const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.js");


//endpoint for new user registration
router.post('/user/signup/', userController.userSignup);

//endpoint for user login
router.post('/user/login/', userController.userLogin);


module.exports = router;