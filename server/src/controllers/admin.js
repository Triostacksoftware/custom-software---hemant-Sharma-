const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Employee = require("../models/employee.js");
const Groups = require("../models/group.js");
const User = require("../models/user.js");
const Transaction = require("../models/transaction.js");
const BiddingRound = require("../models/biddingRound.js");
const Bid = require("../models/bid.js");



//create login token using jwt
function generateAccessToken(id, name) {
    return jwt.sign(
        { employeeId: id, name: name },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
    );
}

//controller handling admin login
exports.adminLogin = async (req, res, next) => {
    try {
        const { phoneNumber, password } = req.body;
        //form data validation
        if (!phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //admins are registered in the employee table with the role as admin.
        //check if the admin exists or not
        const employee = await Employee.findOne({ phoneNumber });
        if (!employee) {
            return res.status(409).json({ error: "Admin does not exist" });
        }

        //check approval status
        if (employee.approvalStatus !== "APPROVED") {
            return res.status(403).json({ error: "Awaiting approval from admin" });
        }

        //check if the employee is an admin or not
        if (employee.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });
        }

        const passwordMatch = await bcrypt.compare(password, employee.password);  //compare the password
        if (!passwordMatch) {
            return res.status(400).json({ error: "Incorrect password" });
        }

        return res.status(200).json({
            message: "Login successful",
            success: true,
            token: generateAccessToken(employee._id, employee.name)
        });

    } catch (error) {

        next(error);
    }
};

//controller to fetch admin dashboard stats
exports.getDashboardStats = async (req, res, next) => {
    try {

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // ── Round 1: all independent queries fire together ────────────────────
        const [
            groupStats,
            userStats,
            employeeStats,
            transactionStats,
            liveBiddingRooms,
            activeGroups
        ] = await Promise.all([

            // Existing: group / user / employee counts via $facet
            Groups.aggregate([{
                $facet: {
                    total: [{ $count: "count" }],
                    active: [{ $match: { status: "ACTIVE" } }, { $count: "count" }],
                    draft: [{ $match: { status: "DRAFT" } }, { $count: "count" }],
                    completed: [{ $match: { status: "COMPLETED" } }, { $count: "count" }],
                }
            }]),

            User.aggregate([{
                $facet: {
                    total: [{ $count: "count" }],
                    pending: [{ $match: { approvalStatus: "PENDING" } }, { $count: "count" }],
                    approved: [{ $match: { approvalStatus: "APPROVED" } }, { $count: "count" }],
                    rejected: [{ $match: { approvalStatus: "REJECTED" } }, { $count: "count" }],
                }
            }]),

            Employee.aggregate([{
                $facet: {
                    total: [{ $count: "count" }],
                    pending: [{ $match: { approvalStatus: "PENDING" } }, { $count: "count" }],
                    approved: [{ $match: { approvalStatus: "APPROVED" } }, { $count: "count" }],
                    rejected: [{ $match: { approvalStatus: "REJECTED" } }, { $count: "count" }],
                }
            }]),

            // Today's and this month's COMPLETED contribution totals
            Transaction.aggregate([
                {
                    $match: {
                        type: "CONTRIBUTION",
                        status: "COMPLETED"
                    }
                },
                {
                    $facet: {
                        today: [
                            { $match: { handledAt: { $gte: startOfToday } } },
                            { $group: { _id: null, total: { $sum: "$amount" } } }
                        ],
                        thisMonth: [
                            { $match: { handledAt: { $gte: startOfThisMonth } } },
                            { $group: { _id: null, total: { $sum: "$amount" } } }
                        ]
                    }
                }
            ]),

            // Count of live bidding rooms
            BiddingRound.countDocuments({ status: "OPEN" }),

            // Active groups with currentMonth — needed for Round 2
            Groups.find({ status: "ACTIVE" })
                .select("_id currentMonth totalMembers")
                .lean()
        ]);

        // ── Round 2: fetch current payment-phase rounds for active groups ──────
        const groupIds = activeGroups.map(g => g._id);
        const groupMonthMap = new Map(activeGroups.map(g => [g._id.toString(), g]));

        const currentRounds = groupIds.length
            ? await BiddingRound.find({
                groupId: { $in: groupIds },
                status: { $in: ["PAYMENT_OPEN", "ADMIN_ROUND"] }
            }).select("_id groupId monthNumber status payablePerMember winnerReceivableAmount winnerUserId").lean()
            : [];

        // Filter to only rounds matching the group's current month
        const activePaymentRounds = currentRounds.filter(r => {
            const group = groupMonthMap.get(r.groupId.toString());
            return group && r.monthNumber === group.currentMonth;
        });

        // ── Round 3: aggregate COMPLETED transactions for those rounds ─────────
        const roundIds = activePaymentRounds.map(r => r._id);

        const txAgg = roundIds.length
            ? await Transaction.aggregate([
                {
                    $match: {
                        biddingRoundId: { $in: roundIds.map(id => new mongoose.Types.ObjectId(id)) },
                        status: "COMPLETED"
                    }
                },
                {
                    $group: {
                        _id: {
                            biddingRoundId: "$biddingRoundId",
                            userId: "$userId",
                            type: "$type"
                        },
                        totalPaid: { $sum: "$amount" }
                    }
                }
            ])
            : [];

        // ── Financial calculations ─────────────────────────────────────────────
        let pendingCollectionThisMonth = 0;
        let pendingPayoutThisMonth = 0;
        let membersToCollectFromCount = 0;
        let membersToPay = 0;

        activePaymentRounds.forEach(round => {
            const group = groupMonthMap.get(round.groupId.toString());
            if (!group) return;

            // ── Pending payout — winner only ──────────────────────────────────
            if (round.winnerUserId) {
                const winnerTx = txAgg.find(
                    item =>
                        item._id.biddingRoundId.toString() === round._id.toString() &&
                        item._id.userId.toString() === round.winnerUserId.toString() &&
                        item._id.type === "WINNER_PAYOUT"
                );
                const paidPayout = winnerTx?.totalPaid || 0;
                const pending = Math.max(0, (round.winnerReceivableAmount || 0) - paidPayout);

                if (pending > 0) {
                    pendingPayoutThisMonth += pending;
                    membersToPay++;
                }
            }

            // ── Pending contributions — all non-winner members ────────────────
            // Get all per-member contribution payments for this round
            const contributionTxs = txAgg.filter(
                item =>
                    item._id.biddingRoundId.toString() === round._id.toString() &&
                    item._id.type === "CONTRIBUTION"
            );

            let totalPaidContribution = 0;
            let membersPaidFull = 0;

            contributionTxs.forEach(item => {
                totalPaidContribution += item.totalPaid;
                if (item.totalPaid >= (round.payablePerMember || 0)) {
                    membersPaidFull++;
                }
            });

            // For ADMIN_ROUND (month 1): winnerUserId is null (admin won),
            // all members pay full monthlyContribution = payablePerMember
            const nonWinnerCount = group.totalMembers;
            const expectedTotal = (round.payablePerMember || 0) * nonWinnerCount;
            const pendingTotal = Math.max(0, expectedTotal - totalPaidContribution);

            pendingCollectionThisMonth += pendingTotal;
            membersToCollectFromCount += Math.max(0, nonWinnerCount - membersPaidFull);
        });

        // ── Shape response ────────────────────────────────────────────────────
        const g = groupStats[0];
        const u = userStats[0];
        const e = employeeStats[0];
        const t = transactionStats[0];

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalGroups: g.total[0]?.count || 0,
                    totalMembers: u.approved[0]?.count || 0,
                    pendingCollectionThisMonth,
                    pendingPayoutThisMonth,
                    todaysCollection: t.today[0]?.total || 0,
                    thisMonthsCollection: t.thisMonth[0]?.total || 0,
                },
                actionBadges: {
                    membersToCollectFrom: membersToCollectFromCount,
                    membersToPay,
                    liveBiddingRooms
                },

                // Kept from existing controller — used by other admin UI screens
                groups: {
                    total: g.total[0]?.count || 0,
                    active: g.active[0]?.count || 0,
                    draft: g.draft[0]?.count || 0,
                    completed: g.completed[0]?.count || 0,
                },
                users: {
                    total: u.total[0]?.count || 0,
                    pending: u.pending[0]?.count || 0,
                    approved: u.approved[0]?.count || 0,
                    rejected: u.rejected[0]?.count || 0,
                },
                employees: {
                    total: e.total[0]?.count || 0,
                    pending: e.pending[0]?.count || 0,
                    approved: e.approved[0]?.count || 0,
                    rejected: e.rejected[0]?.count || 0,
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

//controller for creating groups
exports.createGroup = async (req, res, next) => {
    try {
        const { name, totalMembers, totalMonths, monthlyContribution } = req.body;

        //form data validation
        if (!name || !totalMembers || !totalMonths || !monthlyContribution) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        //business logic validation
        if (totalMembers !== totalMonths) {
            return res.status(400).json({
                success: false,
                message: "Total members must be equal to total months"
            });
        }

        if (monthlyContribution <= 0) {
            return res.status(400).json({
                success: false,
                message: "Monthly contribution must be greater than zero"
            });
        }

        //create group in DRAFT state
        const group = await Groups.create({
            name,
            totalMembers,
            totalMonths,
            monthlyContribution,
            members: [],
            currentMonth: 1,
            status: "DRAFT"
        });

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            groupId: group._id
        });

    } catch (error) {

        next(error);
    }
}

//controller for adding members to group
exports.addMemberToGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;   //groupId to be sent as query params
        const { userId } = req.body;      //userId on request body, can be configured later

        //validate IDs
        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid groupId or userId" });

        }
        //fetch group
        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        //check group status(member can;t be added if group is no in DRAFT state)
        if (group.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Members can only be added while group is in DRAFT state"
            });
        }

        //check capacity of group (number of members should not be greater than totalMembers)
        if (group.members.length >= group.totalMembers) {
            return res.status(400).json({
                success: false,
                message: "Group member limit reached"
            });
        }

        //fetch users
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        //only approved users can be added to groups
        if (user.approvalStatus !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: "User is not approved"
            });
        }

        //prevent duplicate member addition
        const alreadyMember = group.members.some(
            member => member.userId.toString() === userId
        );

        if (alreadyMember) {
            return res.status(409).json({
                success: false,
                message: "User already added to this group"
            });
        }

        //add member
        group.members.push({
            userId,
            hasWon: false,
            status: "ACTIVE"
        });

        await group.save();

        return res.status(200).json({
            success: true,
            message: "Member added to group successfully",
            currentCount: group.members.length
        });


    } catch (error) {

        next(error);

    }
};


//controller to activate a group
exports.activateGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        //validate groupId
        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "Group ID is required"
            });
        }

        //fetch group
        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        //group must be in DRAFT
        if (group.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Only DRAFT groups can be activated"
            });
        }

        //member count must match
        if (group.members.length !== group.totalMembers) {
            return res.status(400).json({
                success: false,
                message: "Group must have all members before activation"
            });
        }

        //activate group
        group.status = "ACTIVE";

        group.startDate = new Date();

        await group.save();

        return res.status(200).json({
            success: true,
            message: "Group activated successfully",
            startDate: group.startDate
        });

    } catch (error) {

        next(error);
    }
};


//controller to fetch all the members
exports.getMembers = async (req, res, next) => {
    try {

        //raw values from query
        const { page, limit, search } = req.query;

        //Sanitize the values
        const currentPage = Math.max(1, Number(page) || 1);
        const resultsPerPage = Math.max(1, Number(limit) || 10);
        const searchTerm = search?.trim() || "";

        //calculate number of documents to skip
        const skipAmount = (currentPage - 1) * resultsPerPage;

        //build the search filter
        const queryFilter = searchTerm
            ? {
                $or: [
                    { name: { $regex: searchTerm, $options: "i" } },
                    { phoneNumber: { $regex: searchTerm, $options: "i" } }
                ]
            }
            : {};

        const [members, totalMembers] = await Promise.all([
            User.find(queryFilter)
                .select("-password")  //never send passwords
                .sort({ createdAt: -1 })
                .skip(skipAmount)
                .limit(resultsPerPage),
            User.countDocuments(queryFilter)
        ]);

        return res.status(200).json({
            success: true,
            message: "Members fetched successfully",
            data: {
                members,
                pagination: {
                    total: totalMembers,
                    currentPage,
                    totalPages: Math.ceil(totalMembers / resultsPerPage),
                },
            },
        });

    } catch (error) {
        next(error);
    }
};


//controller to fetch all the employee
exports.getEmployees = async (req, res, next) => {
    try {

        const { page, limit, search, approvalStatus } = req.query;

        const currentPage = Math.max(1, Number(page) || 1);
        const resultsPerPage = Math.max(1, Number(limit) || 10);
        const searchTerm = search?.trim() || "";
        const statusFilter = approvalStatus?.trim() || "";

        const skipAmount = (currentPage - 1) * resultsPerPage;

        // Build filter
        const queryFilter = {
            ...(searchTerm && {
                $or: [
                    { name: { $regex: searchTerm, $options: "i" } },
                    { phoneNumber: { $regex: searchTerm, $options: "i" } }
                ]
            }),
            ...(statusFilter && { approvalStatus: statusFilter })
        };

        const [employees, totalEmployees] = await Promise.all([
            Employee.find(queryFilter)
                .select("-password")
                .sort({ createdAt: -1 })
                .skip(skipAmount)
                .limit(resultsPerPage),
            Employee.countDocuments(queryFilter)
        ]);

        return res.status(200).json({
            success: true,
            message: "Employees fetched successfully",
            data: {
                employees,
                pagination: {
                    total: totalEmployees,
                    currentPage,
                    totalPages: Math.ceil(totalEmployees / resultsPerPage),
                },
            },
        });

    } catch (error) {
        next(error);
    }
};


//controller to fetch all the groups
exports.getGroups = async (req, res, next) => {
    try {

        const { page, limit, search, status } = req.query;

        const currentPage = Math.max(1, Number(page) || 1);
        const resultsPerPage = Math.max(1, Number(limit) || 10);
        const searchTerm = search?.trim() || "";
        const statusFilter = status?.trim() || "";

        const skipAmount = (currentPage - 1) * resultsPerPage;

        // Build filter
        const queryFilter = {
            ...(searchTerm && {
                name: { $regex: searchTerm, $options: "i" }
            }),
            ...(statusFilter && { status: statusFilter })
        };

        const [groups, totalGroups] = await Promise.all([
            Groups.aggregate([
                { $match: queryFilter }, // Filter first
                { $sort: { createdAt: -1 } }, // Sort
                { $skip: skipAmount }, // Paginate
                { $limit: resultsPerPage },
                {
                    $project: {
                        name: 1,
                        status: 1,
                        // This calculates the size of the array without returning the array itself
                        memberCount: { $size: "$members" },
                        totalMembers: "$totalMembers",
                        totalMonths: 1,
                        monthlyContribution: 1,
                        currentMonth: 1,
                        startDate: 1,
                        endDate: 1
                    }
                }
            ]),
            Groups.countDocuments(queryFilter)
        ]);

        return res.status(200).json({
            success: true,
            message: "Groups fetched successfully",
            data: {
                groups,
                pagination: {
                    total: totalGroups,
                    currentPage,
                    totalPages: Math.ceil(totalGroups / resultsPerPage),
                },
            },
        });

    } catch (error) {
        next(error);
    }
};


//controller to fetch users with approval pending
exports.getPendingUsers = async (req, res, next) => {
    try {
        const { page, limit, search } = req.query;

        //sanitize inputs
        const currentPage = Math.max(1, Number(page) || 1);
        const resultsPerPage = Math.max(1, Number(limit) || 10);
        const searchTerm = search?.trim() || "";

        const skipAmount = (currentPage - 1) * resultsPerPage;

        //query Filter, 
        const queryFilter = {
            approvalStatus: "PENDING",
            ...(searchTerm && {
                $or: [
                    { name: { $regex: searchTerm, $options: "i" } },
                    { email: { $regex: searchTerm, $options: "i" } },
                    { phone: { $regex: searchTerm, $options: "i" } },
                ],
            }),
        };

        // Running find and countDocuments at the same time
        const [pendingUsers, totalCount] = await Promise.all([
            User.find(queryFilter)
                .sort({ createdAt: -1 })
                .skip(skipAmount)
                .limit(resultsPerPage)
                .select("-password")
                .lean(), // Optimization: Returns plain JS objects instead of heavy Mongoose documents
            User.countDocuments(queryFilter),
        ]);

        res.status(200).json({
            success: true,
            message: "Pending users fetched successfully",
            data: {
                users: pendingUsers,
                pagination: {
                    total: totalCount,
                    currentPage,
                    totalPages: Math.ceil(totalCount / resultsPerPage),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};


//controller to fetch pending employees
exports.getPendingEmployees = async (req, res, next) => {
    try {
        const { page, limit, search } = req.query;

        //sanitize inputs
        const currentPage = Math.max(1, Number(page) || 1);
        const resultsPerPage = Math.max(1, Number(limit) || 10);
        const searchTerm = search?.trim() || "";

        const skipAmount = (currentPage - 1) * resultsPerPage;

        //query Filter, 
        const queryFilter = {
            approvalStatus: "PENDING",
            ...(searchTerm && {
                $or: [
                    { name: { $regex: searchTerm, $options: "i" } },
                    { email: { $regex: searchTerm, $options: "i" } },
                    { phone: { $regex: searchTerm, $options: "i" } },
                ],
            }),
        };

        // Running find and countDocuments at the same time
        const [pendingEmployees, totalCount] = await Promise.all([
            Employee.find(queryFilter)
                .sort({ createdAt: -1 })
                .skip(skipAmount)
                .limit(resultsPerPage)
                .select("-password")
                .lean(), // Optimization: Returns plain JS objects instead of heavy Mongoose documents
            Employee.countDocuments(queryFilter),
        ]);

        res.status(200).json({
            success: true,
            message: "Pending employees fetched successfully",
            data: {
                employees: pendingEmployees,
                pagination: {
                    total: totalCount,
                    currentPage,
                    totalPages: Math.ceil(totalCount / resultsPerPage),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};


//controller to approve users
exports.approveUser = async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(403).json({ error: "User ID is required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.approvalStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `User already ${user.status.toLowerCase()}`,
            });
        }

        user.approvalStatus = "APPROVED";
        await user.save();

        res.status(200).json({
            success: true,
            message: "User approved successfully",
        });
    } catch (error) {
        next(error);
    }
};


//controller to reject users
exports.rejectUser = async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(403).json({ error: "User ID is required" });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.approvalStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `User already ${user.status.toLowerCase()}`,
            });
        }

        user.approvalStatus = "REJECTED";
        await user.save();

        res.status(200).json({
            success: true,
            message: "User rejected successfully",
        });
    } catch (error) {
        next(error);
    }
};


//controller to approve employees
exports.approveEmployee = async (req, res, next) => {
    try {
        const { employeeId } = req.body;

        if (!employeeId) {
            return res.status(403).json({ error: "Employee ID is required" });
        }

        const employee = await Employee.findById(employeeId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        if (employee.approvalStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Employee already ${employee.status.toLowerCase()}`,
            });
        }

        employee.approvalStatus = "APPROVED";
        await employee.save();

        res.status(200).json({
            success: true,
            message: "Employee approved successfully",
        });
    } catch (error) {
        next(error);
    }
};


//controller to reject employee
exports.rejectEmployee = async (req, res, next) => {
    try {
        const { employeeId } = req.body;

        if (!employeeId) {
            return res.status(403).json({ error: "Employee ID is required" });
        }

        const employee = await Employee.findById(employeeId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        if (employee.approvalStatus !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Employee already ${employee.status.toLowerCase()}`,
            });
        }

        employee.approvalStatus = "REJECTED";
        await employee.save();

        res.status(200).json({
            success: true,
            message: "Employee rejected successfully",
        });
    } catch (error) {
        next(error);
    }
};


// Controller to get full group details including member financial stats
exports.getGroupDetails = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ success: false, message: "Invalid group ID" });
        }

        const group = await Groups.findById(groupId)
            .populate("members.userId", "name phoneNumber")
            .select("-__v")
            .lean();

        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        const { members, currentMonth } = group;

        const biddingRounds = await BiddingRound.find({ groupId })
            .select("monthNumber payablePerMember winnerReceivableAmount winnerUserId")
            .lean();

        const transactionAgg = await Transaction.aggregate([
            {
                $match: {
                    groupId: new mongoose.Types.ObjectId(groupId),
                    status: "COMPLETED"
                }
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "handledBy",
                    foreignField: "_id",
                    as: "collector"
                }
            },
            { $unwind: { path: "$collector", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$userId",
                    totalPaid: {
                        $sum: { $cond: [{ $eq: ["$type", "CONTRIBUTION"] }, "$amount", 0] }
                    },
                    currentMonthPaid: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$monthNumber", currentMonth] },
                                        { $eq: ["$type", "CONTRIBUTION"] }
                                    ]
                                },
                                "$amount",
                                0
                            ]
                        }
                    },
                    contributionHistory: {
                        $push: {
                            monthNumber: "$monthNumber",
                            amountPaid: "$amount",
                            type: "$type",
                            paymentMode: "$paymentMode",
                            collectedAt: "$handledAt",
                            collectorName: "$collector.name"
                        }
                    }
                }
            }
        ]);

        const transactionMap = new Map(transactionAgg.map(item => [item._id.toString(), item]));

        let totalCollected = 0;
        let currentMonthCollection = 0;

        // NEW: Track group-level pending amounts for the current month
        let groupPendingCollectionThisMonth = 0;
        let groupPendingPayoutThisMonth = 0;

        const currentRound = biddingRounds.find(r => r.monthNumber === currentMonth);

        const membersResponse = members.map(member => {
            const userId = member.userId?._id?.toString();
            const txData = transactionMap.get(userId) || {};

            const totalPaid = txData.totalPaid || 0;
            const currentMonthPaid = txData.currentMonthPaid || 0;
            const history = txData.contributionHistory || [];

            totalCollected += totalPaid;
            currentMonthCollection += currentMonthPaid;

            let expectedTillNow = 0;
            biddingRounds.forEach(round => {
                if (round.winnerUserId?.toString() !== userId) {
                    expectedTillNow += round.payablePerMember || 0;
                }
            });

            // NEW: Calculate exactly what this member owes/receives THIS month
            let currentMonthPendingContribution = 0;
            let currentMonthPendingPayout = 0;

            if (currentRound) {
                if (currentRound.winnerUserId?.toString() === userId) {
                    // Member is the winner this month
                    const receivedThisMonth = history
                        .filter(tx => tx.monthNumber === currentMonth && tx.type === "WINNER_PAYOUT")
                        .reduce((sum, tx) => sum + tx.amountPaid, 0);

                    currentMonthPendingPayout = Math.max(0, (currentRound.winnerReceivableAmount || 0) - receivedThisMonth);
                    groupPendingPayoutThisMonth += currentMonthPendingPayout;
                } else {
                    // Member is a contributor this month
                    currentMonthPendingContribution = Math.max(0, (currentRound.payablePerMember || 0) - currentMonthPaid);
                    groupPendingCollectionThisMonth += currentMonthPendingContribution;
                }
            }

            return {
                userId,
                name: member.userId?.name || "Unknown User",
                phone: member.userId?.phoneNumber || null,
                hasWon: member.hasWon,
                winningMonth: member.winningMonth,
                totalPaid,
                totalReceived: member.totalReceived || 0,
                expectedTillNow,
                pendingAmount: Math.max(0, expectedTillNow - totalPaid),
                currentMonthPaid,
                currentMonthPendingContribution, // Sent to frontend
                currentMonthPendingPayout,       // Sent to frontend
                contributionHistory: history
            };
        });

        const winnersCount = members.filter(m => m.hasWon).length;

        return res.status(200).json({
            success: true,
            data: {
                group: {
                    _id: group._id,
                    name: group.name,
                    status: group.status,
                    monthlyContribution: group.monthlyContribution,
                    totalMembers: group.totalMembers,
                    totalMonths: group.totalMonths,
                    currentMonth: group.currentMonth
                },
                financialSummary: {
                    totalCollected,
                    currentMonthCollection,
                    winnersCount,
                    groupPendingCollectionThisMonth, // Sent to frontend
                    groupPendingPayoutThisMonth      // Sent to frontend
                },
                members: membersResponse
            }
        });

    } catch (error) {
        next(error);
    }
};


// controller to get full basic and financial details of a member
exports.getMemberDetails = async (req, res, next) => {

    try {

        const { userId } = req.params;

        //Validate userId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid userId"
            });
        }

        const userObjId = new mongoose.Types.ObjectId(userId);

        //Fetch user, transactions, and groups in parallel
        const [user, transactionAgg, groups] = await Promise.all([

            User.findById(userId).select("-password").lean(),

            Transaction.aggregate([
                {
                    $match: {
                        userId: userObjId,
                        status: "COMPLETED"
                    }
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "handledBy",
                        foreignField: "_id",
                        as: "collector"
                    }
                },
                { $unwind: { path: "$collector", preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: "$groupId",

                        totalContribution: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$type", "CONTRIBUTION"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        totalPayout: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$type", "WINNER_PAYOUT"] },
                                    "$amount",
                                    0
                                ]
                            }
                        },

                        paymentHistory: {
                            $push: {
                                monthNumber: "$monthNumber",
                                amountPaid: "$amount",
                                type: "$type",
                                paymentMode: "$paymentMode",
                                collectedAt: "$handledAt",
                                remarks: "$remarks",
                                collectorName: "$collector.name"
                            }
                        }
                    }
                }
            ]),

            Groups.find({ "members.userId": userId }).lean()
        ]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const transactionMap = new Map(
            transactionAgg.map(c => [c._id.toString(), c])
        );

        let totalPaidAcrossGroups = 0;

        //Process each group
        const groupResponses = await Promise.all(

            groups.map(async (group) => {

                const stats = transactionMap.get(group._id.toString()) || {};

                const totalContribution = stats.totalContribution || 0;
                const totalPayout = stats.totalPayout || 0;

                totalPaidAcrossGroups += totalContribution;

                const memberInfo = group.members.find(
                    m => m.userId.toString() === userId
                );

                // Fetch bidding rounds of this group
                const rounds = await BiddingRound.find({
                    groupId: group._id
                }).select("payablePerMember winnerUserId").lean();

                // Calculate expected contribution
                let expectedTillNow = 0;

                rounds.forEach(round => {

                    if (round.winnerUserId?.toString() !== userId) {
                        expectedTillNow += round.payablePerMember || 0;
                    }

                });

                return {
                    groupId: group._id,
                    groupName: group.name,
                    groupStatus: group.status,
                    monthlyContribution: group.monthlyContribution,
                    currentMonth: group.currentMonth,
                    totalPaidInGroup: totalContribution,
                    totalReceivedInGroup: totalPayout,
                    expectedTillNow,
                    pendingAmount: Math.max(0, expectedTillNow - totalContribution),
                    hasWon: memberInfo?.hasWon || false,
                    winningMonth: memberInfo?.winningMonth || null,
                    totalReceived: memberInfo?.totalReceived || 0,
                    paymentHistory: stats.paymentHistory || []
                };

            })

        );

        return res.status(200).json({
            success: true,
            data: {
                user,
                financialSummary: {
                    totalPaidAcrossGroups,
                    totalGroups: groups.length
                },
                groups: groupResponses
            }
        });

    } catch (error) {
        next(error);
    }
};


// Controller to open bidding
exports.openBidding = async (req, res, next) => {
    try {
        const { groupId, minBid, maxBid, bidMultiple } = req.body;

        //Input validation
        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "Group ID is required"
            });
        }

        if (minBid === undefined || maxBid === undefined || bidMultiple === undefined) {
            return res.status(400).json({
                success: false,
                message: "minBid, maxBid and bidMultiple are required"
            });
        }

        if (typeof minBid !== "number" || typeof maxBid !== "number" || typeof bidMultiple !== "number") {
            return res.status(400).json({
                success: false,
                message: "minBid, maxBid and bidMultiple must be numbers"
            });
        }

        if (minBid <= 0 || maxBid <= 0 || bidMultiple <= 0) {
            return res.status(400).json({
                success: false,
                message: "minBid, maxBid and bidMultiple must be greater than zero"
            });
        }

        if (minBid >= maxBid) {
            return res.status(400).json({
                success: false,
                message: "minBid must be less than maxBid"
            });
        }

        //Group validation
        const group = await Groups.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        if (group.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Group is not active"
            });
        }

        if (group.currentMonth > group.totalMonths) {
            return res.status(400).json({
                success: false,
                message: "All months are already completed"
            });
        }

        // Block month 1 — admin round, no bidding
        if (group.currentMonth === 1) {
            return res.status(400).json({
                success: false,
                message: "Month 1 is the admin round. Bidding starts from month 2"
            });
        }

        // Ensure no round is already OPEN for this group
        const openRoundExists = await BiddingRound.findOne({
            groupId,
            status: "OPEN"
        });

        if (openRoundExists) {
            return res.status(400).json({
                success: false,
                message: "A bidding round is already open for this group"
            });
        }

        const now = new Date();
        const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        //Find existing PENDING round or create one
        // Fallback: if no round exists yet, create one directly as OPEN.
        const existingRound = await BiddingRound.findOne({
            groupId,
            monthNumber: group.currentMonth
        });

        let biddingRound;

        if (existingRound) {
            // Round exists but is not PENDING — cannot reopen
            if (existingRound.status !== "PENDING") {
                return res.status(400).json({
                    success: false,
                    message: `Bidding for this month is already in '${existingRound.status}' state and cannot be reopened`
                });
            }

            // Update PENDING round with limits and open it
            existingRound.status = "OPEN";
            existingRound.minBid = minBid;
            existingRound.maxBid = maxBid;
            existingRound.bidMultiple = bidMultiple;
            existingRound.startedAt = now;
            existingRound.endedAt = twoHoursLater;
            biddingRound = await existingRound.save();

        } else {
            // No round exists yet — create directly as OPEN
            const totalPoolAmount = group.totalMembers * group.monthlyContribution;

            biddingRound = await BiddingRound.create({
                groupId,
                monthNumber: group.currentMonth,
                totalPoolAmount,
                status: "OPEN",
                minBid,
                maxBid,
                bidMultiple,
                startedAt: now,
                endedAt: twoHoursLater
            });
        }

        // Emit socket event to the bidding room
        const io = req.app.get("io");
        io.to(biddingRound._id.toString()).emit("biddingOpened", {
            biddingRoundId: biddingRound._id,
            monthNumber: biddingRound.monthNumber,
            endsAt: biddingRound.endedAt,
            minBid: biddingRound.minBid,
            maxBid: biddingRound.maxBid,
            bidMultiple: biddingRound.bidMultiple
        });

        return res.status(200).json({
            success: true,
            message: "Bidding opened successfully",
            data: {
                biddingRoundId: biddingRound._id,
                monthNumber: biddingRound.monthNumber,
                endsAt: biddingRound.endedAt,
                minBid: biddingRound.minBid,
                maxBid: biddingRound.maxBid,
                bidMultiple: biddingRound.bidMultiple
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to close bidding
exports.closeBidding = async (req, res, next) => {
    try {
        const { biddingRoundId } = req.body;

        if (!biddingRoundId) {
            return res.status(400).json({
                success: false,
                message: "Bidding round ID is required"
            });
        }

        const round = await BiddingRound.findById(biddingRoundId);

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        if (round.status !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "Bidding is not open or already closed"
            });
        }

        // Fetch all bids sorted in descending order
        const bids = await Bid.find({ biddingRoundId })
            .sort({ bidAmount: -1 })
            .populate("userId", "name");

        if (bids.length === 0) {
            round.status = "CLOSED";
            await round.save();

            return res.status(200).json({
                success: true,
                message: "Bidding closed. No bids were placed."
            });
        }

        const highestBidAmount = bids[0].bidAmount;

        // Get all users with highest bid
        const highestBidders = bids.filter(
            bid => bid.bidAmount === highestBidAmount
        );

        //Tie case
        if (highestBidders.length > 1) {

            round.status = "CLOSED";
            await round.save();

            return res.status(200).json({
                success: true,
                tie: true,
                message: "Tie detected. Admin must select winner.",
                tiedUsers: highestBidders.map(bid => ({
                    userId: bid.userId._id,
                    name: bid.userId.name,
                    bidAmount: bid.bidAmount
                }))
            });
        }

        //single winner case
        const winnerBid = highestBidders[0];

        const group = await Groups.findById(round.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Associated group not found"
            });
        }

        const totalMembers = group.totalMembers;
        const totalPool = round.totalPoolAmount;
        const winningBidAmount = winnerBid.bidAmount;

        // Calculate contribution and payout financials
        const dividendPerMember = Math.floor(winningBidAmount / totalMembers);
        const payablePerMember = group.monthlyContribution - dividendPerMember;
        const winnerReceivableAmount = totalPool - winningBidAmount;

        //update round
        round.status = "PAYMENT_OPEN";
        round.winnerUserId = winnerBid.userId._id;
        round.winningBidAmount = winningBidAmount;
        round.dividendPerMember = dividendPerMember;
        round.payablePerMember = payablePerMember;
        round.winnerReceivableAmount = winnerReceivableAmount;
        // round.finalizedAt = new Date();

        await round.save();

        // update winner in group.members
        await Groups.updateOne(
            { _id: group._id, "members.userId": winnerBid.userId._id },
            {
                $set: {
                    "members.$.hasWon": true,
                    "members.$.winningMonth": round.monthNumber,
                    "members.$.currentPaymentStatus": "PAID"
                }
            }
        );

        //Set all other members to PENDING
        await Groups.updateOne(
            { _id: group._id },
            {
                $set: {
                    "members.$[elem].currentPaymentStatus": "PENDING"
                }
            },
            {
                arrayFilters: [{ "elem.userId": { $ne: winnerBid.userId._id } }]
            }
        );

        //emit final results
        const io = req.app.get("io");

        io.to(biddingRoundId.toString()).emit("biddingClosed", {
            winnerUserId: winnerBid.userId._id,
            winnerName: winnerBid.userId.name,
            winningBidAmount,
            winnerReceivableAmount,
            dividendPerMember,
            payablePerMember,
        });

        return res.status(200).json({
            success: true,
            message: "Bidding closed successfully",
            data: {
                winnerUserId: winnerBid.userId._id,
                winnerName: winnerBid.userId.name,
                winningBidAmount,
                winnerReceivableAmount,
                dividendPerMember,
                payablePerMember
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to resolve tie (admin selects winner)
exports.resolveTie = async (req, res, next) => {
    try {
        const { biddingRoundId, winnerUserId } = req.body;

        if (!biddingRoundId || !winnerUserId) {
            return res.status(400).json({
                success: false,
                message: "Bidding round ID and winner user ID are required"
            });
        }

        const round = await BiddingRound.findById(biddingRoundId);

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        // Ensure round is CLOSED but winner not yet decided
        if (round.status !== "CLOSED" || round.winnerUserId) {
            return res.status(400).json({
                success: false,
                message: "Tie resolution not allowed for this round"
            });
        }

        // Fetch all bids sorted descending
        const bids = await Bid.find({ biddingRoundId })
            .sort({ bidAmount: -1 })
            .populate("userId", "name");

        if (bids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No bids found for this round"
            });
        }

        const highestBidAmount = bids[0].bidAmount;

        // Filter highest bidders
        const highestBidders = bids.filter(
            bid => bid.bidAmount === highestBidAmount
        );

        if (highestBidders.length <= 1) {
            return res.status(400).json({
                success: false,
                message: "No tie exists for this round"
            });
        }

        // Check selected winner is among tied users
        const selectedWinner = highestBidders.find(
            bid => bid.userId._id.toString() === winnerUserId
        );

        if (!selectedWinner) {
            return res.status(400).json({
                success: false,
                message: "Selected user is not among tied highest bidders"
            });
        }

        // Fetch group
        const group = await Groups.findById(round.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Associated group not found"
            });
        }

        const totalMembers = group.totalMembers;
        const totalPool = round.totalPoolAmount;
        const winningBidAmount = highestBidAmount;

        //Financial calculations
        const winnerReceivableAmount = totalPool - winningBidAmount;
        const dividendPerMember = Math.floor(winningBidAmount / totalMembers);
        const payablePerMember = group.monthlyContribution - dividendPerMember;

        //Update round
        round.status = "PAYMENT_OPEN";
        round.winnerUserId = selectedWinner.userId._id;
        round.winningBidAmount = winningBidAmount;
        round.winnerReceivableAmount = winnerReceivableAmount;
        round.dividendPerMember = dividendPerMember;
        round.payablePerMember = payablePerMember;
        // round.finalizedAt = new Date();

        await round.save();

        //Update winner in group.members
        await Groups.updateOne(
            { _id: group._id, "members.userId": selectedWinner.userId._id },
            {
                $set: {
                    "members.$.hasWon": true,
                    "members.$.winningMonth": round.monthNumber,
                    "members.$.currentPaymentStatus": "PAID"
                }
            }
        );

        //Set others to PENDING
        await Groups.updateOne(
            { _id: group._id },
            {
                $set: {
                    "members.$[elem].currentPaymentStatus": "PENDING"
                }
            },
            {
                arrayFilters: [{ "elem.userId": { $ne: selectedWinner.userId._id } }]
            }
        );

        // Emit final result
        const io = req.app.get("io");

        io.to(biddingRoundId.toString()).emit("biddingClosed", {
            winnerUserId: selectedWinner.userId._id,
            winnerName: selectedWinner.userId.name,
            winningBidAmount,
            winnerReceivableAmount,
            dividendPerMember,
            payablePerMember
        });

        return res.status(200).json({
            success: true,
            message: "Tie resolved successfully",
            data: {
                winnerUserId: selectedWinner.userId._id,
                winnerName: selectedWinner.userId.name,
                winningBidAmount,
                winnerReceivableAmount,
                dividendPerMember,
                payablePerMember
            }
        });

    } catch (error) {
        next(error);
    }
};


// Controller to finalize bidding and move the group to the next month.
exports.finalizeBidding = async (req, res, next) => {
    try {

        const { biddingRoundId } = req.body;

        if (!biddingRoundId) {
            return res.status(400).json({
                success: false,
                message: "Bidding round ID is required"
            });
        }

        //Fetch and validate bidding round
        const round = await BiddingRound.findById(biddingRoundId);

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        if (round.status !== "PAYMENT_OPEN") {
            return res.status(400).json({
                success: false,
                message: "Bidding cannot be finalized at this stage"
            });
        }

        //Fetch group with member details
        const group = await Groups.findById(round.groupId)
            .populate("members.userId", "name phoneNumber")
            .lean();

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Associated group not found"
            });
        }

        const winnerId = round.winnerUserId.toString();
        const payablePerMember = round.payablePerMember;
        const winnerReceivable = round.winnerReceivableAmount;

        //Aggregate COMPLETED amounts per member for this round and
        // compare each against the required amount. Any member whose COMPLETED total
        // is less than their required amount is genuinely pending.
        const completedAgg = await Transaction.aggregate([
            {
                $match: {
                    biddingRoundId: new mongoose.Types.ObjectId(biddingRoundId),
                    status: "COMPLETED"    // only count employee-verified payments
                }
            },
            {
                $group: {
                    _id: { userId: "$userId", type: "$type" },
                    totalCompleted: { $sum: "$amount" }
                }
            }
        ]);

        // Build lookup maps: userId → completed total
        const completedContributionMap = new Map(); // non-winner contributions
        let completedPayoutTotal = 0;               // winner payout received

        completedAgg.forEach(entry => {
            const uid = entry._id.userId.toString();
            const type = entry._id.type;
            if (type === "CONTRIBUTION") completedContributionMap.set(uid, entry.totalCompleted);
            if (type === "WINNER_PAYOUT") completedPayoutTotal = entry.totalCompleted;
        });

        //Check each non-winning member's contribution
        const activeMembers = group.members.filter(m => m.status === "ACTIVE");

        const pendingMembers = []; // collects everyone who hasn't fully paid/received

        activeMembers.forEach(member => {
            const memberId = member.userId._id.toString();

            if (memberId === winnerId) return; // winner checked separately below

            const completed = completedContributionMap.get(memberId) || 0;
            const remaining = payablePerMember - completed;

            if (remaining > 0) {
                pendingMembers.push({
                    name: member.userId.name,
                    phoneNumber: member.userId.phoneNumber,
                    type: "CONTRIBUTION",
                    required: payablePerMember,
                    paid: completed,
                    remaining
                });
            }
        });

        //Check winner's payout receipt
        const winnerRemainingPayout = winnerReceivable - completedPayoutTotal;

        if (winnerRemainingPayout > 0) {
            const winnerMember = activeMembers.find(
                m => m.userId._id.toString() === winnerId
            );
            if (winnerMember) {
                pendingMembers.push({
                    name: winnerMember.userId.name,
                    phoneNumber: winnerMember.userId.phoneNumber,
                    type: "WINNER_PAYOUT",
                    required: winnerReceivable,
                    paid: completedPayoutTotal,
                    remaining: winnerRemainingPayout
                });
            }
        }

        //Block finalization if anyone is still pending
        if (pendingMembers.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot finalize — some payments are incomplete",
                pendingMembers
            });
        }

        //All payments verified — finalize the round
        const roundDoc = await BiddingRound.findById(biddingRoundId);
        roundDoc.status = "FINALIZED";
        roundDoc.finalizedAt = new Date();
        await roundDoc.save();

        // Move group to next month and reset member payment statuses
        const groupDoc = await Groups.findById(round.groupId);
        groupDoc.currentMonth += 1;
        groupDoc.members.forEach(member => {
            member.currentPaymentStatus = "PENDING";
        });

        // Mark the group as COMPLETED if the full cycle is done
        if (groupDoc.currentMonth > groupDoc.totalMonths) {
            groupDoc.status = "COMPLETED";
        }

        await groupDoc.save();

        return res.status(200).json({
            success: true,
            message: "Bidding finalized successfully",
            data: {
                groupId: groupDoc._id,
                biddingRoundId: roundDoc._id,
                nextMonth: groupDoc.currentMonth,
                groupStatus: groupDoc.status,
                totalMonths: groupDoc.totalMonths
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to get current bidding round details for admin dashboard
exports.getCurrentBiddingRound = async (req, res, next) => {
    try {

        const { groupId } = req.params;

        //Validate groupId
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId"
            });
        }

        const groupObjectId = new mongoose.Types.ObjectId(groupId);

        //Fetch group to determine current month
        const group = await Groups.findById(groupObjectId)
            .select("currentMonth")
            .lean();

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        //fetch current bidding round
        const round = await BiddingRound.findOne({
            groupId: groupObjectId,
            monthNumber: group.currentMonth
        })
            .populate("winnerUserId", "name")
            .lean();

        //If no round exists
        if (!round) {
            return res.status(200).json({
                success: true,
                data: null
            });
        }

        //Fetch bid count
        const bidsCount = await Bid.countDocuments({
            biddingRoundId: round._id
        });

        // Validate bid range (10% - 20%)
        const minBid = round.totalPoolAmount * 0.10;
        const maxBid = round.totalPoolAmount * 0.20;

        //Build response
        const response = {
            _id: round._id,
            groupId: round.groupId,
            monthNumber: round.monthNumber,
            status: round.status,

            startedAt: round.startedAt || null,
            endedAt: round.endedAt || null,

            totalPoolAmount: round.totalPoolAmount || null,

            winnerUserId: round.winnerUserId?._id || null,
            winnerName: round.winnerUserId?.name || null,

            winningBidAmount: round.winningBidAmount || null,

            payablePerMember: round.payablePerMember || null,
            winnerReceivableAmount: round.winnerReceivableAmount || null,
            dividendPerMember: round.dividendPerMember || null,

            bidsCount,

            minBid,
            maxBid
        };

        return res.status(200).json({
            success: true,
            data: response
        });

    } catch (error) {
        next(error);
    }
};


// Controller to etch all bids for a specific bidding round
exports.getBidsForRound = async (req, res, next) => {
    try {

        const { roundId } = req.params;

        //Validate roundId
        if (!mongoose.Types.ObjectId.isValid(roundId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid roundId"
            });
        }

        const roundObjectId = new mongoose.Types.ObjectId(roundId);

        //Ensure bidding round exists
        const roundExists = await BiddingRound.exists({ _id: roundObjectId });

        if (!roundExists) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        //Fetch bids sorted chronologically
        const bids = await Bid.find({ biddingRoundId: roundObjectId })
            .populate("userId", "name")
            .sort({ createdAt: 1 }) // ascending order (oldest first)
            .select("userId bidAmount createdAt")
            .lean();

        //Transform response to match frontend contract
        const responseData = bids.map(bid => ({
            userId: bid.userId?._id || null,
            name: bid.userId?.name || "Unknown User",
            bidAmount: bid.bidAmount,
            timestamp: bid.createdAt
        }));

        return res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (error) {
        next(error);
    }
};


//controller to get employee transaction history
exports.getEmployeeTransactionHistory = async (req, res, next) => {
    try {
        const { employeeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID"
            });
        }

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const skip = (page - 1) * limit;

        // Verify employee exists
        const employee = await Employee.findById(employeeId)
            .select("name phoneNumber role approvalStatus")
            .lean();

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Run count and fetch in parallel
        const [transactions, total] = await Promise.all([
            Transaction.find({ handledBy: employeeId })
                .sort({ handledAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("groupId", "name")
                .populate("userId", "name phoneNumber")
                .select("type amount handledAt status groupId userId monthNumber paymentMode remarks")
                .lean(),

            Transaction.countDocuments({ handledBy: employeeId })
        ]);

        // Reshape populated fields to clean response format
        const formattedTransactions = transactions.map(tx => ({
            _id: tx._id,
            type: tx.type,
            amount: tx.amount,
            handledAt: tx.handledAt,
            status: tx.status,
            monthNumber: tx.monthNumber,
            paymentMode: tx.paymentMode,
            remarks: tx.remarks || null,
            group: tx.groupId ? {
                _id: tx.groupId._id,
                name: tx.groupId.name
            } : null,
            member: tx.userId ? {
                _id: tx.userId._id,
                name: tx.userId.name,
                phoneNumber: tx.userId.phoneNumber
            } : null
        }));

        return res.status(200).json({
            success: true,
            data: {
                employee: {
                    _id: employee._id,
                    name: employee.name,
                    phoneNumber: employee.phoneNumber,
                    role: employee.role
                },
                transactions: formattedTransactions,
                pagination: {
                    total,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    limit,
                    hasNextPage: page * limit < total
                }
            }
        });

    } catch (error) {
        next(error);
    }
};