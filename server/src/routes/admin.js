const express = require("express");
const router = express.Router();

const adminController = require("../controllers/admin.js");
const authentication = require("../middleware/authentication.js");


//endpoint for admin login
router.post('/admin/login/', adminController.adminLogin);

//endpoint to get admin dashboard stats
router.get('/admin/dashboard/stats/', authentication.authenticate, authentication.isAdmin, adminController.getDashboardStats);

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

//endpoint to fetch group details
router.get('/admin/group/fetch/group_details/:groupId', authentication.authenticate, authentication.isAdmin, adminController.getGroupDetails);

//endpoint to fetch member details
router.get('/admin/users/fetch/details/:userId', authentication.authenticate, authentication.isAdmin, adminController.getMemberDetails);

//endpoint to open bidding for a group
router.post('/admin/bidding/open/', authentication.authenticate, authentication.isAdmin, adminController.openBidding);

//endpoint to close a bidding for a group
router.post('/admin/bidding/close/', authentication.authenticate, authentication.isAdmin, adminController.closeBidding);

//endpoint to resolve a tie in a bidding
router.post('/admin/bidding/resolve-tie/', authentication.authenticate, authentication.isAdmin, adminController.resolveTie);

//endpoint to finalize a bidding
router.post('/admin/bidding/finalize/', authentication.authenticate, authentication.isAdmin, adminController.finalizeBidding);

//endpoint to get current biddingRound details for admin dashboard
router.get('/admin/bidding/current/:groupId', authentication.authenticate, authentication.isAdmin, adminController.getCurrentBiddingRound);

//endpoint to get bid details for a bidding round
router.get('/admin/bidding/round/:roundId/bids', authentication.authenticate, authentication.isAdmin, adminController.getBidsForRound);

//endpoint to get transaction history logged by a specific employee
router.get('/admin/employees/fetch/history/:employeeId', authentication.authenticate, authentication.isAdmin, adminController.getEmployeeTransactionHistory);

//endpoint to fetch details of pending contributions
router.get('/admin/collections/pending', authentication.authenticate, authentication.isAdmin, adminController.getPendingCollections);

//endpoint to fetch the details of pending payouts
router.get('/admin/payouts/pending', authentication.authenticate, authentication.isAdmin, adminController.getPendingPayouts);


// ── Ads ───────────────────────────────────────────────────────────────────────
router.post('/admin/ads', authentication.authenticate, authentication.isAdmin, adminController.createAd);
router.get('/admin/ads', authentication.authenticate, authentication.isAdmin, adminController.getAllAds);
router.patch('/admin/ads/:adId', authentication.authenticate, authentication.isAdmin, adminController.updateAd);
router.patch('/admin/ads/:adId/activate', authentication.authenticate, authentication.isAdmin, adminController.activateAd);
router.patch('/admin/ads/:adId/deactivate', authentication.authenticate, authentication.isAdmin, adminController.deactivateAd);
router.delete('/admin/ads/:adId', authentication.authenticate, authentication.isAdmin, adminController.deleteAd);


module.exports = router;