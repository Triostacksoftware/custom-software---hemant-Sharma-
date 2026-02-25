const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.js");
const authentication = require("../middleware/authentication.js");


//endpoint for new employee registration
router.post('/employee/signup/', employeeController.employeeSignup);

//endpoint for employee login
router.post('/employee/login/', employeeController.employeeLogin);

//endpoint to log monthly contribution
router.post('/employee/group/contribution/log_contribution/', authentication.authenticate, employeeController.logContribution);

//endpoint to fetch employee dashboard
router.get('/employee/dashboard/', authentication.authenticate, employeeController.getEmployeeDashboard);

//endpoint to get the list of active groups
router.get('/employee/groups/active', authentication.authenticate, employeeController.getActiveGroups);

//endpoint to fetch members whose contribution is pending
router.get('/employee/groups/:groupId/pending_members/', authentication.authenticate, employeeController.getContributionPendingMembers);


module.exports = router;