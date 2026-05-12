const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.js");
const authentication = require("../middleware/authentication.js");

// ============================================================================
// 1. AUTHENTICATION & PUBLIC
// ============================================================================

// Endpoint for new employee registration
router.post('/employee/signup/', employeeController.employeeSignup);

// Endpoint for employee login
router.post('/employee/login/', employeeController.employeeLogin);


// ============================================================================
// 2. DASHBOARD & GROUPS
// ============================================================================

// Endpoint to fetch employee dashboard
router.get('/employee/dashboard/', authentication.authenticate, employeeController.getEmployeeDashboard);

// Endpoint to get the list of active groups
router.get('/employee/groups/active', authentication.authenticate, employeeController.getActiveGroups);


// ============================================================================
// 3. TRANSACTIONS & COLLECTIONS
// ============================================================================

// Endpoint to fetch members whose contribution/payout is pending
router.get('/employee/pending_members/', authentication.authenticate, employeeController.getTransactionPendingMembers);

// Endpoint to log a transaction (monthly contribution or payout)
router.post('/employee/log_transaction/', authentication.authenticate, employeeController.logTransaction);

// Endpoint to fetch transaction history logged by this employee
router.get('/employee/transactions/history/', authentication.authenticate, employeeController.getEmployeeTransactionHistory);


// ============================================================================
// 4. CASH TRANSFERS (INTER-EMPLOYEE)
// ============================================================================

// Endpoint to fetch approved employees for the cash transfer dropdown
router.get('/employee/transfer-directory', authentication.authenticate, employeeController.getApprovedEmployeesForTransfer);

// Endpoint to initiate a cash transfer to another employee
router.post('/employee/cash-transfer', authentication.authenticate, employeeController.initiateCashTransfer);

// Endpoint to confirm a received cash transfer
router.patch('/employee/cash-transfer/:transferId/confirm', authentication.authenticate, employeeController.confirmCashTransfer);

// Endpoint to cancel an initiated cash transfer
router.patch('/employee/cash-transfer/:transferId/cancel', authentication.authenticate, employeeController.cancelCashTransfer);

// Endpoint to get inter-employee transfer history
router.get('/employee/cash-transfer/history', authentication.authenticate, employeeController.getCashTransferHistory);


// ============================================================================
// 5. NOTIFICATIONS & PUSH
// ============================================================================

// Endpoint to get unread notifications
router.get('/employee/notifications', authentication.authenticate, employeeController.getNotifications);

// Endpoint to get unread notification count
router.get('/employee/notifications/unread-count', authentication.authenticate, employeeController.getUnreadNotificationCount);

// Endpoint to save push subscription object for notifications
router.post('/employee/push-subscription', authentication.authenticate, employeeController.saveEmployeePushSubscription);


module.exports = router;