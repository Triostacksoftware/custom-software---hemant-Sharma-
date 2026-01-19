const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.js");


//endpoint for new employee registration
router.post('/employee/signup/', employeeController.employeeSignup);

//endpoint for employee login
router.post('/employee/login/', employeeController.employeeLogin);


module.exports = router;