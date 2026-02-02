const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.js");
const authentication = require("../middleware/authentication.js");


//endpoint for admin login
router.post('/admin/login/', adminController.adminLogin);

//endpoint for group creation
router.post('/admin/create_group/', authentication.authenticate, authentication.isAdmin, adminController.createGroup);


module.exports = router;