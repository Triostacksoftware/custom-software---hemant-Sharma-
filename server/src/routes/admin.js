const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.js");
const authentication = require("../middleware/authentication.js");


//endpoint for admin login
router.post('/admin/login/', adminController.adminLogin);


module.exports = router;