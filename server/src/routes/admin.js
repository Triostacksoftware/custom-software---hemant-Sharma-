const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.js");
const authentication = require("../middleware/authentication.js");


//endpoint for admin login
router.post('/admin/login/', adminController.adminLogin);

//endpoint for group creation
router.post('/admin/create_group/', authentication.authenticate, authentication.isAdmin, adminController.createGroup);

//endpoint to add new members to group
router.post('/admin/group/add_member/:groupId', authentication.authenticate, authentication.isAdmin, adminController.addMemberToGroup);

//endpoint to activate a group
router.post('/admin/group/activate_group/:groupId', authentication.authenticate, authentication.isAdmin, adminController.activateGroup);

//endpoint to fetch all members (pagination optional)
router.get('/admin/users/fetch_all', authentication.authenticate, authentication.isAdmin, adminController.getMembers);


module.exports = router;