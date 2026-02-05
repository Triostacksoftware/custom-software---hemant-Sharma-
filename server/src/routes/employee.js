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


module.exports = router;