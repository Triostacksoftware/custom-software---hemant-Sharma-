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

//endpoint to fetch all groups
router.get('/admin/groups/fetch_all', authentication.authenticate, authentication.isAdmin, adminController.getGroups);

//endpoint to fetch all employees
router.get('/admin/employees/fetch_all', authentication.authenticate, authentication.isAdmin, adminController.getEmployees);

//endpoint to fetch pending members
router.get('/admin/users/fetch/pending_user/', authentication.authenticate, authentication.isAdmin, adminController.getPendingUsers);

//endpoint to fetch pending employees
router.get('/admin/employees/fetch/pending_employee/', authentication.authenticate, authentication.isAdmin, adminController.getPendingEmployees);

//endpoint to approve users
router.post('/admin/users/approve_user/', authentication.authenticate, authentication.isAdmin, adminController.approveUser);

//endpoint to reject users
router.post('/admin/users/reject_user', authentication.authenticate, authentication.isAdmin, adminController.rejectUser);

//endpoint to approve employees
router.post('/admin/employees/approve_employee', authentication.authenticate, authentication.isAdmin, adminController.approveEmployee);

//endpoint to reject users
router.post('/admin/employees/reject_employee', authentication.authenticate, authentication.isAdmin, adminController.rejectEmployee);


module.exports = router;