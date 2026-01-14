const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.js");


//endpoint for new user registration
router.post('/user/signup/', userController.userSignup);


module.exports = router;