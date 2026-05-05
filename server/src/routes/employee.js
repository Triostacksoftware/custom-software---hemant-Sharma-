const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.js");
const authentication = require("../middleware/authentication.js");


//endpoint for new employee registration
router.post('/employee/signup/', employeeController.employeeSignup);

//endpoint for employee login
router.post('/employee/login/', employeeController.employeeLogin);

//endpoint to log monthly contribution
router.post('/employee/log_transaction/', authentication.authenticate, employeeController.logTransaction);

//endpoint to fetch employee dashboard
router.get('/employee/dashboard/', authentication.authenticate, employeeController.getEmployeeDashboard);

//endpoint to get the list of active groups
router.get('/employee/groups/active', authentication.authenticate, employeeController.getActiveGroups);

//endpoint to fetch members whose contribution is pending
router.get('/employee/pending_members/', authentication.authenticate, employeeController.getTransactionPendingMembers);

//endpoint to fetch transaction history
router.get('/employee/transactions/history/', authentication.authenticate, employeeController.getEmployeeTransactionHistory);

//endpoint to get unread notification count
router.get('/employee/notifications/unread-count', authentication.authenticate, employeeController.getUnreadNotificationCount);

//endpoint to get unread notifications
router.get('/employee/notifications', authentication.authenticate, employeeController.getNotifications);

//endpoint to save push subscription object
router.post('/employee/push-subscription', authentication.authenticate, employeeController.saveEmployeePushSubscription);

//endpoint to initiate cash transfer between employees
router.post('/employee/cash-transfer', authentication.authenticate, employeeController.initiateCashTransfer);

//endpoint to confirm a cash transfer
router.patch('/employee/cash-transfer/:transferId/confirm', authentication.authenticate, employeeController.confirmCashTransfer);

//endpoint to cancel a cash transfer
router.patch('/employee/cash-transfer/:transferId/cancel', authentication.authenticate, employeeController.cancelCashTransfer);

//endpoint to get inter employee transfer history
router.get('/employee/cash-transfer/history', authentication.authenticate, employeeController.getCashTransferHistory);


module.exports = router;