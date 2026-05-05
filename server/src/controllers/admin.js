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
const Ad = require("../models/ads.js");
const Notification = require("../models/notification.js");
const CashTransfer = require("../models/cashTransfer.js");

const {
    notifyMember,
    notifyGroupMembers,
    notifyAllEmployees,
    notifyAdmins
} = require("../services/notificationService.js");


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

// Controller to fetch admin dashboard stats
exports.getDashboardStats = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            groupStats,
            userStats,
            employeeStats,
            transactionStats,
            liveBiddingRooms,
            activeGroups,
            cashInHandAgg
        ] = await Promise.all([

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

            Transaction.aggregate([
                { $match: { type: "CONTRIBUTION", status: "COMPLETED" } },
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

            BiddingRound.countDocuments({ status: "OPEN" }),

            Groups.find({ status: "ACTIVE" })
                .select("_id currentMonth totalMembers members")  // members needed for count fix
                .lean(),

            Transaction.aggregate([
                { $match: { status: "COMPLETED" } },
                {
                    $facet: {
                        totalContributions: [
                            { $match: { type: "CONTRIBUTION" } },
                            { $group: { _id: null, total: { $sum: "$amount" } } }
                        ],
                        totalPayouts: [
                            { $match: { type: "WINNER_PAYOUT" } },
                            { $group: { _id: null, total: { $sum: "$amount" } } }
                        ]
                    }
                }
            ])
        ]);

        const cashAgg = cashInHandAgg[0];
        const totalContributions = cashAgg.totalContributions[0]?.total || 0;
        const totalPayouts = cashAgg.totalPayouts[0]?.total || 0;
        const cashInHand = Math.max(0, totalContributions - totalPayouts);

        const groupIds = activeGroups.map(g => g._id);
        const groupMonthMap = new Map(activeGroups.map(g => [g._id.toString(), g]));

        const currentRounds = groupIds.length
            ? await BiddingRound.find({
                groupId: { $in: groupIds },
                status: { $in: ["PAYMENT_OPEN", "ADMIN_ROUND"] }
            }).select("_id groupId monthNumber status payablePerMember winnerReceivableAmount winnerUserId").lean()
            : [];

        const activePaymentRounds = currentRounds.filter(r => {
            const group = groupMonthMap.get(r.groupId.toString());
            return group && r.monthNumber === group.currentMonth;
        });

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

        let pendingCollectionThisMonth = 0;
        let pendingPayoutThisMonth = 0;
        let membersToCollectFromCount = 0;
        let membersToPay = 0;

        activePaymentRounds.forEach(round => {
            const group = groupMonthMap.get(round.groupId.toString());
            if (!group) return;

            const winnerIdStr = round.winnerUserId?.toString();

            // Pending payout — winner only
            if (winnerIdStr) {
                const winnerTx = txAgg.find(
                    item =>
                        item._id.biddingRoundId.toString() === round._id.toString() &&
                        item._id.userId.toString() === winnerIdStr &&
                        item._id.type === "WINNER_PAYOUT"
                );
                const paidPayout = winnerTx?.totalPaid || 0;
                const pending = Math.max(0, (round.winnerReceivableAmount || 0) - paidPayout);

                if (pending > 0) {
                    pendingPayoutThisMonth += pending;
                    membersToPay++;
                }
            }

            // ── FIX: nonWinnerCount excludes admin ────────────────────────────
            //
            // group.members[] contains ONLY regular users — admin is not in it.
            // So group.members.length = totalMembers - 1 (admin excluded).
            //
            // For ADMIN_ROUND (month 1): all regular members owe contribution.
            //   nonWinnerCount = group.members.length
            //
            // For PAYMENT_OPEN (month 2+): regular members minus the winner.
            //   nonWinnerCount = regular members who are not the winner
            //   = group.members.filter(m => m.userId != winnerId).length
            //
            // This means admin's own contribution is never counted as pending,
            // which is correct — admin adds it implicitly without being collected.
            const regularNonWinners = group.members.filter(
                m => m.userId.toString() !== winnerIdStr
            );
            const nonWinnerCount = regularNonWinners.length;

            const contributionTxs = txAgg.filter(
                item =>
                    item._id.biddingRoundId.toString() === round._id.toString() &&
                    item._id.type === "CONTRIBUTION"
            );

            let totalPaidContribution = 0;
            let membersPaidFull = 0;

            contributionTxs.forEach(item => {
                totalPaidContribution += item.totalPaid;
                if (item.totalPaid >= (round.payablePerMember || 0)) membersPaidFull++;
            });

            const expectedTotal = (round.payablePerMember || 0) * nonWinnerCount;
            const pendingTotal = Math.max(0, expectedTotal - totalPaidContribution);

            pendingCollectionThisMonth += pendingTotal;
            membersToCollectFromCount += Math.max(0, nonWinnerCount - membersPaidFull);
        });

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
                    cashInHand
                },
                actionBadges: {
                    membersToCollectFrom: membersToCollectFromCount,
                    membersToPay,
                    liveBiddingRooms
                },
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

// Controller for creating groups
exports.createGroup = async (req, res, next) => {
    try {
        const {
            name,
            totalMembers,
            totalMonths,
            monthlyContribution,
            minBid,
            maxBid,
            bidMultiple
        } = req.body;

        // ── Required field validation ─────────────────────────────────────────
        if (!name || !totalMembers || !totalMonths || !monthlyContribution) {
            return res.status(400).json({
                success: false,
                message: "name, totalMembers, totalMonths and monthlyContribution are required"
            });
        }

        // ── Bid terms validation ──────────────────────────────────────────────
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

        if (minBid <= 0 || maxBid <= 0 || bidMultiple < 1) {
            return res.status(400).json({
                success: false,
                message: "minBid and maxBid must be greater than zero. bidMultiple must be at least 1"
            });
        }

        if (minBid >= maxBid) {
            return res.status(400).json({
                success: false,
                message: "minBid must be less than maxBid"
            });
        }

        // ── Business logic validation ─────────────────────────────────────────
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

        if (totalMembers < 2) {
            return res.status(400).json({
                success: false,
                message: "Group must have at least 2 members (including admin)"
            });
        }

        const group = await Groups.create({
            name,
            totalMembers,
            totalMonths,
            monthlyContribution,
            adminId: req.employee._id,
            defaultBidTerms: { minBid, maxBid, bidMultiple },
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
};


// Controller for adding members to group
exports.addMemberToGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;

        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId or userId"
            });
        }

        // Fetch group
        const group = await Groups.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        // Members can only be added while group is in DRAFT state
        if (group.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Members can only be added while group is in DRAFT state"
            });
        }

        // Admin occupies one slot via adminId — regular members fill totalMembers - 1 slots
        if (group.members.length >= group.totalMembers - 1) {
            return res.status(400).json({
                success: false,
                message: "Group member limit reached"
            });
        }

        // Fetch user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Only approved users can be added
        if (user.approvalStatus !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: "Only approved users can be added to a group"
            });
        }

        // Prevent duplicate member addition
        const alreadyMember = group.members.some(
            m => m.userId.toString() === userId
        );

        if (alreadyMember) {
            return res.status(409).json({
                success: false,
                message: "User is already a member of this group"
            });
        }

        // Add member
        group.members.push({
            userId,
            hasWon: false,
            status: "ACTIVE"
        });

        await group.save();

        // ── Notify the added member ───────────────────────────────────────────
        //
        // Fire and forget — runs after save so the response is not delayed.
        // Tells the member they have been added to the group.
        const io = req.app.get("io");
        notifyMember(
            userId,
            "Added to a Group",
            `You have been added to the chit group "${group.name}". Monthly contribution: ₹${group.monthlyContribution}.`,
            "MEMBER_ADDED_TO_GROUP",
            io,
            group._id
        );

        return res.status(200).json({
            success: true,
            message: "Member added to group successfully",
            data: {
                currentMemberCount: group.members.length,
                remainingSlots: group.totalMembers - 1 - group.members.length
            }
        });

    } catch (error) {
        next(error);
    }
};


// Controller to activate a group
exports.activateGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "Group ID is required"
            });
        }

        const group = await Groups.findById(groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        if (group.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Only DRAFT groups can be activated"
            });
        }

        if (group.members.length !== group.totalMembers - 1) {
            return res.status(400).json({
                success: false,
                message: "Group must have all members before activation"
            });
        }

        const totalPoolAmount = group.totalMembers * group.monthlyContribution;

        // FIX: adminPayoutAmount = physical cash admin collects from market.
        // Admin's own contribution is implicit — he does not pay himself.
        // Physical collection = (totalMembers - 1) × monthlyContribution
        // = group.members.length × monthlyContribution (same thing, cleaner)
        const adminPayoutAmount = group.members.length * group.monthlyContribution;

        await BiddingRound.create({
            groupId: group._id,
            monthNumber: 1,
            status: "ADMIN_ROUND",
            totalPoolAmount,
            payablePerMember: group.monthlyContribution, // full amount — no dividend in month 1
            dividendPerMember: 0,
            winningBidAmount: 0,
            winnerReceivableAmount: totalPoolAmount,           // conceptual full pool admin receives
            isAdminRound: true,
            adminPayoutAmount,                                 // physical cash collected from market
            startedAt: new Date(),
            endedAt: new Date()
        });

        group.members.forEach(member => {
            member.currentPaymentStatus = "PENDING";
        });

        group.status = "ACTIVE";
        group.startDate = new Date();

        await group.save();

        const io = req.app.get("io");
        notifyGroupMembers(
            group._id,
            "Your Chit Group Has Started! 🎉",
            `"${group.name}" is now active. Please pay your Month 1 contribution of ₹${group.monthlyContribution}.`,
            "GROUP_ACTIVATED",
            io
        );

        return res.status(200).json({
            success: true,
            message: "Group activated successfully. Month 1 collections are now open.",
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

        // Safely calculate lifetime totals from the aggregate result
        let totalPaidAcrossGroups = 0;
        let totalReceivedAcrossGroups = 0;
        let totalGroupsWon = 0;

        transactionAgg.forEach(stat => {
            totalPaidAcrossGroups += stat.totalContribution || 0;
            totalReceivedAcrossGroups += stat.totalPayout || 0;
        });

        //Process each group
        const groupResponses = await Promise.all(
            groups.map(async (group) => {
                const stats = transactionMap.get(group._id.toString()) || {};
                const totalContribution = stats.totalContribution || 0;
                const totalPayout = stats.totalPayout || 0;

                const memberInfo = group.members.find(
                    m => m.userId.toString() === userId
                );

                if (memberInfo?.hasWon) {
                    totalGroupsWon++;
                }

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
                    totalReceivedAcrossGroups, // NEWLY ADDED
                    totalGroups: groups.length,
                    totalGroupsWon
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

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "Group ID is required"
            });
        }

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

        if (group.currentMonth === 1) {
            return res.status(400).json({
                success: false,
                message: "Month 1 is the admin round. Bidding starts from month 2"
            });
        }

        const openRoundExists = await BiddingRound.findOne({ groupId, status: "OPEN" });
        if (openRoundExists) {
            return res.status(400).json({
                success: false,
                message: "A bidding round is already open for this group"
            });
        }

        const existingRound = await BiddingRound.findOne({
            groupId,
            monthNumber: group.currentMonth
        });

        if (existingRound && existingRound.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Bidding for this month is already in '${existingRound.status}' state and cannot be reopened`
            });
        }

        // ── Resolve bid terms ─────────────────────────────────────────────────
        //
        // Priority:
        //   1. Explicit values in request body (manual override)
        //   2. Terms already stored on the round (admin used update-terms endpoint)
        //   3. Group's defaultBidTerms (set during group creation)
        const resolvedMinBid = (typeof minBid === "number" && minBid > 0)
            ? minBid
            : (existingRound?.minBid > 0
                ? existingRound.minBid
                : group.defaultBidTerms?.minBid);

        const resolvedMaxBid = (typeof maxBid === "number" && maxBid > 0)
            ? maxBid
            : (existingRound?.maxBid > 0
                ? existingRound.maxBid
                : group.defaultBidTerms?.maxBid);

        const resolvedBidMultiple = (typeof bidMultiple === "number" && bidMultiple >= 1)
            ? bidMultiple
            : (existingRound?.bidMultiple > 1
                ? existingRound.bidMultiple
                : group.defaultBidTerms?.bidMultiple || 1);

        // Validate resolved terms
        if (!resolvedMinBid || !resolvedMaxBid || resolvedMinBid <= 0 || resolvedMaxBid <= 0) {
            return res.status(400).json({
                success: false,
                message: "Bid terms could not be resolved. Please update the round terms via PATCH /admin/bidding/update-terms/:roundId"
            });
        }

        if (resolvedMinBid >= resolvedMaxBid) {
            return res.status(400).json({
                success: false,
                message: "minBid must be less than maxBid. Please update the round terms."
            });
        }

        // endedAt = 8:00 PM IST today (cron auto-closes at 8pm)
        // Calculated as today 20:00 IST converted to UTC
        const now = new Date();
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
        const eightPmUTC = new Date(
            Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 20, 0, 0)
        );
        const endedAt = new Date(eightPmUTC.getTime() - IST_OFFSET_MS);

        let biddingRound;

        if (existingRound) {
            existingRound.status = "OPEN";
            existingRound.minBid = resolvedMinBid;
            existingRound.maxBid = resolvedMaxBid;
            existingRound.bidMultiple = resolvedBidMultiple;
            existingRound.startedAt = now;
            existingRound.endedAt = endedAt;
            biddingRound = await existingRound.save();
        } else {
            const totalPoolAmount = group.totalMembers * group.monthlyContribution;
            biddingRound = await BiddingRound.create({
                groupId,
                monthNumber: group.currentMonth,
                totalPoolAmount,
                status: "OPEN",
                minBid: resolvedMinBid,
                maxBid: resolvedMaxBid,
                bidMultiple: resolvedBidMultiple,
                startedAt: now,
                endedAt
            });
        }

        const io = req.app.get("io");
        io.to(biddingRound._id.toString()).emit("biddingOpened", {
            biddingRoundId: biddingRound._id,
            monthNumber: biddingRound.monthNumber,
            endsAt: biddingRound.endedAt,
            minBid: biddingRound.minBid,
            maxBid: biddingRound.maxBid,
            bidMultiple: biddingRound.bidMultiple
        });

        const body = `Bidding is now live for "${group.name}" — Month ${group.currentMonth}. Bids close at 8 PM.`;
        notifyGroupMembers(group._id, "Bidding is Live! 🔨", body, "BIDDING_OPEN", io);
        notifyAllEmployees("Bidding is Live! 🔨", body, "BIDDING_OPEN", io, group._id);

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

        // ── PREVIOUS MANUAL FLOW (commented out) ─────────────────────────────
        // Admin was required to send minBid, maxBid, bidMultiple in the body
        // every time they opened bidding. Now these are stored on the round
        // from group creation (defaultBidTerms) and auto-opened by cron at 5pm.
        //
        // if (minBid === undefined || maxBid === undefined || bidMultiple === undefined) {
        //     return res.status(400).json({ message: "minBid, maxBid and bidMultiple are required" });
        // }
        // ... strict validation of each field ...
        // existingRound.minBid = minBid; existingRound.maxBid = maxBid; ...
        // ─────────────────────────────────────────────────────────────────────

    } catch (error) {
        next(error);
    }
};


// Controller to close bidding
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

        const bids = await Bid.find({ biddingRoundId })
            .sort({ bidAmount: -1 })
            .populate("userId", "name");

        const io = req.app.get("io");

        // No bids placed
        if (bids.length === 0) {
            round.status = "CLOSED";
            await round.save();

            const group = await Groups.findById(round.groupId).select("name _id").lean();

            notifyAdmins(
                "Bidding Closed — No Bids",
                `No bids were placed for "${group?.name}" Month ${round.monthNumber}. Please reopen bidding.`,
                "BIDDING_CLOSED",
                io,
                round.groupId
            );

            return res.status(200).json({
                success: true,
                message: "Bidding closed. No bids were placed."
            });
        }

        const highestBidAmount = bids[0].bidAmount;
        const highestBidders = bids.filter(bid => bid.bidAmount === highestBidAmount);

        // Tie case
        if (highestBidders.length > 1) {
            round.status = "CLOSED";
            await round.save();

            const group = await Groups.findById(round.groupId).select("name _id").lean();

            notifyAdmins(
                "Bidding Tie — Action Required ⚠️",
                `A tie was detected in "${group?.name}" Month ${round.monthNumber}. Please select the winner.`,
                "BIDDING_TIE",
                io,
                round.groupId
            );

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

        // Single winner
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
        const dividendPerMember = Math.floor(winningBidAmount / totalMembers);
        const payablePerMember = group.monthlyContribution - dividendPerMember;

        // FIX: deduct admin's implicit contribution from winner's receivable.
        //
        // OLD: winnerReceivable = totalPool - winningBidAmount
        //      = 1,20,000 - 3,000 = ₹1,17,000  ← wrong, includes admin's share
        //
        // NEW: winnerReceivable = totalPool - winningBidAmount - payablePerMember
        //      = 1,20,000 - 3,000 - 39,000 = ₹78,000 ✓
        //
        // Admin physically collects payablePerMember from each non-winner regular
        // member and adds his own payablePerMember implicitly. The winner receives
        // only what flows in from regular member payments — not admin's implicit share.
        const winnerReceivable = totalPool - winningBidAmount - payablePerMember;

        round.status = "PAYMENT_OPEN";
        round.winnerUserId = winnerBid.userId._id;
        round.winningBidAmount = winningBidAmount;
        round.dividendPerMember = dividendPerMember;
        round.payablePerMember = payablePerMember;
        round.winnerReceivableAmount = winnerReceivable;

        await round.save();

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

        await Groups.updateOne(
            { _id: group._id },
            { $set: { "members.$[elem].currentPaymentStatus": "PENDING" } },
            { arrayFilters: [{ "elem.userId": { $ne: winnerBid.userId._id } }] }
        );

        io.to(biddingRoundId.toString()).emit("biddingClosed", {
            winnerUserId: winnerBid.userId._id,
            winnerName: winnerBid.userId.name,
            winningBidAmount,
            winnerReceivableAmount: winnerReceivable,
            dividendPerMember,
            payablePerMember
        });

        const { notifyMember } = require("../services/notificationService");

        notifyGroupMembers(
            group._id,
            "Bidding Result — Payments Now Open 🎉",
            `Month ${round.monthNumber} bidding is complete for "${group.name}". Please pay your contribution of ₹${payablePerMember}.`,
            "BIDDING_CLOSED",
            io
        );

        notifyMember(
            winnerBid.userId._id,
            "Congratulations! You Won! 🏆",
            `You won the Month ${round.monthNumber} bid in "${group.name}"! You will receive ₹${winnerReceivable}.`,
            "BIDDING_CLOSED",
            io,
            group._id
        );

        notifyAllEmployees(
            "Bidding Closed — Collections Open",
            `Month ${round.monthNumber} bidding is complete for "${group.name}". Collections and payout can now begin.`,
            "BIDDING_CLOSED",
            io,
            group._id
        );

        return res.status(200).json({
            success: true,
            message: "Bidding closed successfully",
            data: {
                winnerUserId: winnerBid.userId._id,
                winnerName: winnerBid.userId.name,
                winningBidAmount,
                winnerReceivableAmount: winnerReceivable,
                dividendPerMember,
                payablePerMember
            }
        });

    } catch (error) {
        next(error);
    }
};


// Controller to resolve tie (admin selects winner)
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

        if (round.status !== "CLOSED" || round.winnerUserId) {
            return res.status(400).json({
                success: false,
                message: "Tie resolution not allowed for this round"
            });
        }

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
        const highestBidders = bids.filter(bid => bid.bidAmount === highestBidAmount);

        if (highestBidders.length <= 1) {
            return res.status(400).json({
                success: false,
                message: "No tie exists for this round"
            });
        }

        const selectedWinner = highestBidders.find(
            bid => bid.userId._id.toString() === winnerUserId
        );

        if (!selectedWinner) {
            return res.status(400).json({
                success: false,
                message: "Selected user is not among tied highest bidders"
            });
        }

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
        const dividendPerMember = Math.floor(winningBidAmount / totalMembers);
        const payablePerMember = group.monthlyContribution - dividendPerMember;

        // FIX: same formula as closeBidding — deduct admin's implicit contribution
        const winnerReceivable = totalPool - winningBidAmount - payablePerMember;

        round.status = "PAYMENT_OPEN";
        round.winnerUserId = selectedWinner.userId._id;
        round.winningBidAmount = winningBidAmount;
        round.winnerReceivableAmount = winnerReceivable;
        round.dividendPerMember = dividendPerMember;
        round.payablePerMember = payablePerMember;

        await round.save();

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

        await Groups.updateOne(
            { _id: group._id },
            { $set: { "members.$[elem].currentPaymentStatus": "PENDING" } },
            { arrayFilters: [{ "elem.userId": { $ne: selectedWinner.userId._id } }] }
        );

        const io = req.app.get("io");
        io.to(biddingRoundId.toString()).emit("biddingClosed", {
            winnerUserId: selectedWinner.userId._id,
            winnerName: selectedWinner.userId.name,
            winningBidAmount,
            winnerReceivableAmount: winnerReceivable,
            dividendPerMember,
            payablePerMember
        });

        const { notifyMember } = require("../services/notificationService");

        notifyGroupMembers(
            group._id,
            "Tie Resolved — Payments Now Open",
            `The tie in Month ${round.monthNumber} for "${group.name}" has been resolved. Please pay your contribution of ₹${payablePerMember}.`,
            "BIDDING_CLOSED",
            io
        );

        notifyMember(
            selectedWinner.userId._id,
            "Congratulations! You Won! 🏆",
            `You were selected as the winner for Month ${round.monthNumber} in "${group.name}"! You will receive ₹${winnerReceivable}.`,
            "BIDDING_CLOSED",
            io,
            group._id
        );

        notifyAllEmployees(
            "Tie Resolved — Collections Open",
            `The tie in "${group.name}" Month ${round.monthNumber} is resolved. Collections and payout can now begin.`,
            "BIDDING_CLOSED",
            io,
            group._id
        );

        return res.status(200).json({
            success: true,
            message: "Tie resolved successfully",
            data: {
                winnerUserId: selectedWinner.userId._id,
                winnerName: selectedWinner.userId.name,
                winningBidAmount,
                winnerReceivableAmount: winnerReceivable,
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
            return res.status(400).json({ success: false, message: "Bidding round ID is required" });
        }

        const round = await BiddingRound.findById(biddingRoundId);
        if (!round) {
            return res.status(404).json({ success: false, message: "Bidding round not found" });
        }

        if (round.status !== "PAYMENT_OPEN") {
            return res.status(400).json({
                success: false,
                message: round.status === "ADMIN_ROUND"
                    ? "Month 1 (admin round) finalizes automatically when all members have paid"
                    : `Bidding cannot be finalized at this stage. Current status: ${round.status}`
            });
        }

        const group = await Groups.findById(round.groupId)
            .populate("members.userId", "name phoneNumber")
            .lean();

        if (!group) {
            return res.status(404).json({ success: false, message: "Associated group not found" });
        }

        const winnerId = round.winnerUserId.toString();
        const payablePerMember = round.payablePerMember;
        const winnerReceivable = round.winnerReceivableAmount;

        const completedAgg = await Transaction.aggregate([
            {
                $match: {
                    biddingRoundId: new mongoose.Types.ObjectId(biddingRoundId),
                    status: "COMPLETED"
                }
            },
            {
                $group: {
                    _id: { userId: "$userId", type: "$type" },
                    totalCompleted: { $sum: "$amount" }
                }
            }
        ]);

        const completedContributionMap = new Map();
        let completedPayoutTotal = 0;

        completedAgg.forEach(entry => {
            const uid = entry._id.userId.toString();
            const type = entry._id.type;
            if (type === "CONTRIBUTION") completedContributionMap.set(uid, entry.totalCompleted);
            if (type === "WINNER_PAYOUT") completedPayoutTotal = entry.totalCompleted;
        });

        const activeMembers = group.members.filter(m => m.status === "ACTIVE");
        const pendingMembers = [];

        activeMembers.forEach(member => {
            const memberId = member.userId._id.toString();
            if (memberId === winnerId) return;
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

        const winnerRemainingPayout = winnerReceivable - completedPayoutTotal;
        if (winnerRemainingPayout > 0) {
            const winnerMember = activeMembers.find(m => m.userId._id.toString() === winnerId);
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

        const io = req.app.get("io");

        if (pendingMembers.length > 0) {
            const contributionPending = pendingMembers.filter(m => m.type === "CONTRIBUTION").length;
            const payoutPending = pendingMembers.filter(m => m.type === "WINNER_PAYOUT").length;
            const parts = [];
            if (contributionPending > 0) parts.push(`${contributionPending} member(s) have not fully paid their contribution`);
            if (payoutPending > 0) parts.push(`winner payout is incomplete`);

            notifyAdmins(
                "Cannot Finalize — Payments Incomplete 🚫",
                `"${group.name}" Month ${round.monthNumber} cannot be finalized: ${parts.join(" and ")}.`,
                "FINALIZE_BLOCKED", io, group._id
            );

            return res.status(400).json({
                success: false,
                message: "Cannot finalize — some payments are incomplete",
                pendingMembers
            });
        }

        const now = new Date();

        const roundDoc = await BiddingRound.findById(biddingRoundId);
        roundDoc.status = "FINALIZED";
        roundDoc.finalizedAt = now;
        await roundDoc.save();

        const groupDoc = await Groups.findById(round.groupId);
        groupDoc.currentMonth += 1;
        groupDoc.members.forEach(m => { m.currentPaymentStatus = "PENDING"; });

        if (groupDoc.currentMonth > groupDoc.totalMonths) {
            groupDoc.status = "COMPLETED";
            await groupDoc.save();

            notifyGroupMembers(
                group._id,
                "Chit Group Completed 🎊",
                `"${group.name}" has successfully completed its full cycle of ${group.totalMonths} months. Thank you for participating!`,
                "GROUP_FINALIZED", io
            );

            return res.status(200).json({
                success: true,
                message: "Bidding finalized. Group cycle is now complete!",
                data: { groupId: groupDoc._id, groupStatus: "COMPLETED", totalMonths: groupDoc.totalMonths }
            });
        }

        await groupDoc.save();

        const totalPoolAmount = groupDoc.totalMembers * groupDoc.monthlyContribution;
        const membersNotWon = groupDoc.members.filter(m => !m.hasWon && m.status === "ACTIVE");

        // Auto-winner: only one regular member left — no bidding needed
        if (membersNotWon.length === 1) {
            const defaultWinnerId = membersNotWon[0].userId;
            const defaultPayable = groupDoc.monthlyContribution;
            const defaultReceivable = groupDoc.members.length * groupDoc.monthlyContribution;

            const nextRound = await BiddingRound.create({
                groupId: groupDoc._id,
                monthNumber: groupDoc.currentMonth,
                status: "PAYMENT_OPEN",
                totalPoolAmount,
                winnerUserId: defaultWinnerId,
                winningBidAmount: 0,
                dividendPerMember: 0,
                payablePerMember: defaultPayable,
                winnerReceivableAmount: defaultReceivable,
                isAdminRound: false,
                scheduledBiddingDate: null
            });

            await Groups.updateOne(
                { _id: groupDoc._id, "members.userId": defaultWinnerId },
                { $set: { "members.$.hasWon": true, "members.$.winningMonth": groupDoc.currentMonth, "members.$.currentPaymentStatus": "PAID" } }
            );
            await Groups.updateOne(
                { _id: groupDoc._id },
                { $set: { "members.$[elem].currentPaymentStatus": "PENDING" } },
                { arrayFilters: [{ "elem.userId": { $ne: defaultWinnerId } }] }
            );

            notifyMember(defaultWinnerId, "You're the Default Winner! 🏆",
                `You are the last remaining member in "${group.name}" Month ${groupDoc.currentMonth}. You will receive ₹${defaultReceivable}. Please await your payout.`,
                "BIDDING_CLOSED", io, group._id
            );
            notifyGroupMembers(group._id, `Month ${round.monthNumber} Complete — Final Month Open`,
                `Month ${round.monthNumber} payments are done for "${group.name}". Month ${groupDoc.currentMonth} is the final round — no bidding needed. Payments are now open.`,
                "GROUP_FINALIZED", io
            );
            notifyAdmins(`Final Month — Collect & Pay`,
                `"${group.name}" is in its final month (Month ${groupDoc.currentMonth}). Collect ₹${defaultPayable} from non-winner member(s) and pay ₹${defaultReceivable} to the default winner.`,
                "GROUP_FINALIZED", io, group._id
            );

            return res.status(200).json({
                success: true,
                message: "Bidding finalized. Final month auto-configured — no bidding needed.",
                data: {
                    groupId: groupDoc._id, finalizedRoundId: roundDoc._id,
                    nextMonth: groupDoc.currentMonth, groupStatus: groupDoc.status,
                    totalMonths: groupDoc.totalMonths, nextRoundId: nextRound._id,
                    autoWinner: true, defaultWinnerId, winnerReceivable: defaultReceivable
                }
            });
        }

        // Normal flow: create PENDING round — copy defaultBidTerms from group
        const scheduledBiddingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const nextRound = await BiddingRound.create({
            groupId: groupDoc._id,
            monthNumber: groupDoc.currentMonth,
            status: "PENDING",
            totalPoolAmount,
            isAdminRound: false,
            scheduledBiddingDate,
            // CHANGED: was minBid:0, maxBid:0, bidMultiple:1
            // Now copies group.defaultBidTerms so cron can auto-open at 5pm
            minBid: groupDoc.defaultBidTerms?.minBid || 0,
            maxBid: groupDoc.defaultBidTerms?.maxBid || 0,
            bidMultiple: groupDoc.defaultBidTerms?.bidMultiple || 1
        });

        const biddingDate = scheduledBiddingDate.toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric"
        });

        notifyGroupMembers(group._id, `Month ${round.monthNumber} Complete! 🎉`,
            `All payments for "${group.name}" Month ${round.monthNumber} are done. Bidding for Month ${groupDoc.currentMonth} is scheduled around ${biddingDate}.`,
            "GROUP_FINALIZED", io
        );

        // CHANGED: message now says terms are already set, update only if needed
        notifyAdmins(
            `Month ${round.monthNumber} Finalized — Bidding Scheduled`,
            `"${group.name}" Month ${round.monthNumber} is finalized. Bidding for Month ${groupDoc.currentMonth} auto-opens on ${biddingDate} at 5 PM with terms: Min ₹${nextRound.minBid}, Max ₹${nextRound.maxBid}, Step ₹${nextRound.bidMultiple}. Update terms before 5 PM if needed.`,
            "GROUP_FINALIZED", io, group._id
        );

        return res.status(200).json({
            success: true,
            message: "Bidding finalized successfully. Next month's round is scheduled.",
            data: {
                groupId: groupDoc._id,
                finalizedRoundId: roundDoc._id,
                nextMonth: groupDoc.currentMonth,
                groupStatus: groupDoc.status,
                totalMonths: groupDoc.totalMonths,
                nextRoundId: nextRound._id,
                scheduledBiddingDate: nextRound.scheduledBiddingDate
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


//controller to show every member who has not fully paid
// their contribution for the current month across all active groups.
exports.getPendingCollections = async (req, res, next) => {
    try {
        const { search, groupId } = req.query;
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        //Fetch active groups
        const groupFilter = { status: "ACTIVE" };
        if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
            groupFilter._id = new mongoose.Types.ObjectId(groupId);
        }

        const groups = await Groups.find(groupFilter)
            .select("_id name currentMonth members")
            .lean();

        if (!groups.length) {
            return res.status(200).json({
                success: true,
                data: {
                    summary: { totalPendingAmount: 0, totalPendingMembers: 0 },
                    collections: [],
                    pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false }
                }
            });
        }

        const groupIds = groups.map(g => g._id);
        const groupMap = new Map(groups.map(g => [g._id.toString(), g]));

        //Fetch current payment-phase rounds
        const rounds = await BiddingRound.find({
            groupId: { $in: groupIds },
            status: { $in: ["PAYMENT_OPEN", "ADMIN_ROUND"] }
        })
            .select("_id groupId monthNumber status payablePerMember winnerUserId")
            .lean();

        // Only keep rounds that match the group's current month
        const activeRounds = rounds.filter(r => {
            const group = groupMap.get(r.groupId.toString());
            return group && r.monthNumber === group.currentMonth;
        });

        if (!activeRounds.length) {
            return res.status(200).json({
                success: true,
                data: {
                    summary: { totalPendingAmount: 0, totalPendingMembers: 0 },
                    collections: [],
                    pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false }
                }
            });
        }

        //Aggregate COMPLETED contributions per member per round
        const roundIds = activeRounds.map(r => r._id);

        const txAgg = await Transaction.aggregate([
            {
                $match: {
                    biddingRoundId: { $in: roundIds.map(id => new mongoose.Types.ObjectId(id)) },
                    type: "CONTRIBUTION",
                    status: "COMPLETED"
                }
            },
            {
                $group: {
                    _id: {
                        biddingRoundId: "$biddingRoundId",
                        userId: "$userId"
                    },
                    alreadyPaid: { $sum: "$amount" }
                }
            }
        ]);

        // Build lookup: "roundId_userId" -> alreadyPaid
        const paidMap = new Map();
        txAgg.forEach(item => {
            const key = `${item._id.biddingRoundId}_${item._id.userId}`;
            paidMap.set(key, item.alreadyPaid);
        });

        //Collect all member IDs we need to resolve
        // Build pending records and gather unique userIds for name/phone lookup
        const pendingRecordsRaw = [];
        const userIdsNeeded = new Set();

        activeRounds.forEach(round => {
            const group = groupMap.get(round.groupId.toString());
            if (!group) return;

            const winnerIdStr = round.winnerUserId?.toString();

            group.members.forEach(member => {
                const memberIdStr = member.userId.toString();

                // Winner does not owe a contribution
                if (memberIdStr === winnerIdStr) return;

                const alreadyPaid = paidMap.get(`${round._id}_${memberIdStr}`) || 0;
                const pendingAmount = Math.max(0, (round.payablePerMember || 0) - alreadyPaid);

                // Only include members who still owe something
                if (pendingAmount <= 0) return;

                pendingRecordsRaw.push({
                    userId: member.userId,
                    groupId: group._id,
                    groupName: group.name,
                    currentMonth: round.monthNumber,
                    payableAmount: round.payablePerMember,
                    alreadyPaid,
                    pendingAmount
                });

                userIdsNeeded.add(memberIdStr);
            });
        });

        //Fetch member name and phone in one query
        const users = await User.find({
            _id: { $in: [...userIdsNeeded] }
        })
            .select("_id name phoneNumber")
            .lean();

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        //Build full records with member details + apply search
        let collections = pendingRecordsRaw.map(record => {
            const user = userMap.get(record.userId.toString());
            return {
                memberId: record.userId,
                memberName: user?.name || "Unknown",
                memberPhone: user?.phoneNumber || null,
                groupId: record.groupId,
                groupName: record.groupName,
                currentMonth: record.currentMonth,
                payableAmount: record.payableAmount,  // what they owe this month total
                alreadyPaid: record.alreadyPaid,    // what they have paid so far
                pendingAmount: record.pendingAmount    // what is still outstanding
            };
        });

        // Apply search filter — member name or phone (case-insensitive)
        if (search && search.trim()) {
            const term = search.trim().toLowerCase();
            collections = collections.filter(c =>
                c.memberName.toLowerCase().includes(term) ||
                (c.memberPhone && c.memberPhone.includes(term))
            );
        }

        // Sort by pendingAmount descending — highest pending first
        collections.sort((a, b) => b.pendingAmount - a.pendingAmount);

        //Summary (before pagination)
        const totalPendingAmount = collections.reduce((sum, c) => sum + c.pendingAmount, 0);
        const totalPendingMembers = collections.length;

        //Paginate
        const total = collections.length;
        const totalPages = Math.ceil(total / limit);
        const paginated = collections.slice((page - 1) * limit, page * limit);

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalPendingAmount,   // total outstanding amount across all pending members
                    totalPendingMembers   // total number of member-group pairs with pending dues
                },
                collections: paginated,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages,
                    hasNextPage: page * limit < total
                }
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to get the list of pending for payout members for admin panel
exports.getPendingPayouts = async (req, res, next) => {
    try {
        const { search, groupId } = req.query;
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        // ── Step 1: Fetch active groups ───────────────────────────────────────
        const groupFilter = { status: "ACTIVE" };
        if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
            groupFilter._id = new mongoose.Types.ObjectId(groupId);
        }

        const groups = await Groups.find(groupFilter)
            .select("_id name currentMonth")
            .lean();

        if (!groups.length) {
            return res.status(200).json({
                success: true,
                data: {
                    summary: { totalPendingPayoutAmount: 0, totalPendingWinners: 0 },
                    payouts: [],
                    pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false }
                }
            });
        }

        const groupIds = groups.map(g => g._id);
        const groupMap = new Map(groups.map(g => [g._id.toString(), g]));

        // ── Step 2: Fetch PAYMENT_OPEN rounds for current month ───────────────
        //
        // ADMIN_ROUND is intentionally excluded — admin is in the Employee
        // model, not User model, so there is no WINNER_PAYOUT transaction
        // to track here. Admin payouts are handled separately.
        const rounds = await BiddingRound.find({
            groupId: { $in: groupIds },
            status: "PAYMENT_OPEN",
            winnerUserId: { $ne: null }   // must have a declared winner
        })
            .select("_id groupId monthNumber winnerUserId winnerReceivableAmount winningBidAmount dividendPerMember")
            .lean();

        // Only keep rounds matching the group's current month
        const activePayoutRounds = rounds.filter(r => {
            const group = groupMap.get(r.groupId.toString());
            return group && r.monthNumber === group.currentMonth;
        });

        if (!activePayoutRounds.length) {
            return res.status(200).json({
                success: true,
                data: {
                    summary: { totalPendingPayoutAmount: 0, totalPendingWinners: 0 },
                    payouts: [],
                    pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false }
                }
            });
        }

        // ── Step 3: Aggregate COMPLETED WINNER_PAYOUT transactions ───────────
        const roundIds = activePayoutRounds.map(r => r._id);

        const txAgg = await Transaction.aggregate([
            {
                $match: {
                    biddingRoundId: { $in: roundIds.map(id => new mongoose.Types.ObjectId(id)) },
                    type: "WINNER_PAYOUT",
                    status: "COMPLETED"
                }
            },
            {
                $group: {
                    _id: "$biddingRoundId",
                    alreadyReceived: { $sum: "$amount" }
                }
            }
        ]);

        // Build lookup: roundId -> alreadyReceived
        const receivedMap = new Map(
            txAgg.map(item => [item._id.toString(), item.alreadyReceived])
        );

        // ── Step 4: Build pending records + collect winner userIds ────────────
        const pendingRecordsRaw = [];
        const winnerIdsNeeded = new Set();

        activePayoutRounds.forEach(round => {
            const group = groupMap.get(round.groupId.toString());
            if (!group) return;

            const alreadyReceived = receivedMap.get(round._id.toString()) || 0;
            const pendingAmount = Math.max(0, (round.winnerReceivableAmount || 0) - alreadyReceived);

            // Only include if payout is still pending
            if (pendingAmount <= 0) return;

            pendingRecordsRaw.push({
                winnerUserId: round.winnerUserId,
                groupId: group._id,
                groupName: group.name,
                currentMonth: round.monthNumber,
                winnerReceivableAmount: round.winnerReceivableAmount, // total payout owed
                winningBidAmount: round.winningBidAmount,       // bid that won
                dividendPerMember: round.dividendPerMember,      // dividend each member got
                alreadyReceived,
                pendingAmount
            });

            winnerIdsNeeded.add(round.winnerUserId.toString());
        });

        // ── Step 5: Fetch winner details in one query ─────────────────────────
        const winners = await User.find({
            _id: { $in: [...winnerIdsNeeded] }
        })
            .select("_id name phoneNumber")
            .lean();

        const winnerMap = new Map(winners.map(u => [u._id.toString(), u]));

        // ── Step 6: Build full records + apply search filter ──────────────────
        let payouts = pendingRecordsRaw.map(record => {
            const winner = winnerMap.get(record.winnerUserId.toString());
            return {
                winnerId: record.winnerUserId,
                winnerName: winner?.name || "Unknown",
                winnerPhone: winner?.phoneNumber || null,
                groupId: record.groupId,
                groupName: record.groupName,
                currentMonth: record.currentMonth,
                winnerReceivableAmount: record.winnerReceivableAmount, // total entitled payout
                winningBidAmount: record.winningBidAmount,       // winning bid placed
                dividendPerMember: record.dividendPerMember,      // dividend per non-winner
                alreadyReceived: record.alreadyReceived,        // paid so far
                pendingAmount: record.pendingAmount           // still to be paid out
            };
        });

        // Apply search filter
        if (search && search.trim()) {
            const term = search.trim().toLowerCase();
            payouts = payouts.filter(p =>
                p.winnerName.toLowerCase().includes(term) ||
                (p.winnerPhone && p.winnerPhone.includes(term))
            );
        }

        // Sort by pendingAmount descending — largest outstanding payout first
        payouts.sort((a, b) => b.pendingAmount - a.pendingAmount);

        // ── Step 7: Summary (before pagination) ───────────────────────────────
        const totalPendingPayoutAmount = payouts.reduce((sum, p) => sum + p.pendingAmount, 0);
        const totalPendingWinners = payouts.length;

        // ── Step 8: Paginate ──────────────────────────────────────────────────
        const total = payouts.length;
        const totalPages = Math.ceil(total / limit);
        const paginated = payouts.slice((page - 1) * limit, page * limit);

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalPendingPayoutAmount,  // total amount still to be paid out this month
                    totalPendingWinners        // number of winners still awaiting full payout
                },
                payouts: paginated,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages,
                    hasNextPage: page * limit < total
                }
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to create a new ad. Only one ad can be active at a time.
exports.createAd = async (req, res, next) => {
    try {
        const { adText, adLink, isActive = true } = req.body;

        if (!adText || !adText.trim()) {
            return res.status(400).json({
                success: false,
                message: "adText is required"
            });
        }

        if (!adLink || !adLink.trim()) {
            return res.status(400).json({
                success: false,
                message: "adLink is required"
            });
        }

        // If this new ad is active, deactivate all existing ads first
        if (isActive) {
            await Ad.updateMany({}, { $set: { isActive: false } });
        }

        const ad = await Ad.create({
            adText: adText.trim(),
            adLink: adLink.trim(),
            isActive: !!isActive
        });

        return res.status(201).json({
            success: true,
            message: "Ad created successfully",
            data: { ad }
        });

    } catch (error) {
        next(error);
    }
};


//controller to get all ads sorted by newest first.
exports.getAllAds = async (req, res, next) => {
    try {
        const ads = await Ad.find()
            .sort({ updatedAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: { ads }
        });

    } catch (error) {
        next(error);
    }
};


//controller to update an existing ad's text and/or link.
exports.updateAd = async (req, res, next) => {
    try {
        const { adId } = req.params;
        const { adText, adLink } = req.body;

        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        if (!adText && !adLink) {
            return res.status(400).json({
                success: false,
                message: "At least one of adText or adLink is required"
            });
        }

        const updateFields = {};
        if (adText && adText.trim()) updateFields.adText = adText.trim();
        if (adLink && adLink.trim()) updateFields.adLink = adLink.trim();

        const ad = await Ad.findByIdAndUpdate(
            adId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).lean();

        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Ad updated successfully",
            data: { ad }
        });

    } catch (error) {
        next(error);
    }
};


//controller to Set a specific ad as the active one.
exports.activateAd = async (req, res, next) => {
    try {
        const { adId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const ad = await Ad.findById(adId);

        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        if (ad.isActive) {
            return res.status(400).json({
                success: false,
                message: "This ad is already active"
            });
        }

        // Deactivate all, then activate the selected one
        await Ad.updateMany({}, { $set: { isActive: false } });
        ad.isActive = true;
        await ad.save();

        return res.status(200).json({
            success: true,
            message: "Ad activated successfully",
            data: { ad }
        });

    } catch (error) {
        next(error);
    }
};


//controller to deactivate an ad. The member dashboard marquee will be hidden
exports.deactivateAd = async (req, res, next) => {
    try {
        const { adId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const ad = await Ad.findByIdAndUpdate(
            adId,
            { $set: { isActive: false } },
            { new: true }
        ).lean();

        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Ad deactivated successfully",
            data: { ad }
        });

    } catch (error) {
        next(error);
    }
};


//controller to permanently delete an ad.
exports.deleteAd = async (req, res, next) => {
    try {
        const { adId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const ad = await Ad.findByIdAndDelete(adId).lean();

        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Ad deleted successfully"
        });

    } catch (error) {
        next(error);
    }
};


// Controller to get unread notification count
exports.getUnreadNotificationCount = async (req, res, next) => {
    try {
        const adminId = req.employee._id;

        const count = await Notification.countDocuments({
            recipientId: adminId,
            recipientModel: "Employee",
            isRead: false
        });

        return res.status(200).json({
            success: true,
            data: { count }
        });

    } catch (error) {
        next(error);
    }
};


// Controller to get notifications
exports.getNotifications = async (req, res, next) => {
    try {
        const adminId = req.employee._id;

        const unreadOnly = req.query.unreadOnly === "true";
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const skip = unreadOnly ? 0 : (page - 1) * limit;

        const filter = {
            recipientId: adminId,
            recipientModel: "Employee"
        };

        if (unreadOnly) {
            filter.isRead = false;
        }

        const [notifications, totalCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("title body type groupId isRead status scheduledAt createdAt")
                .lean(),
            Notification.countDocuments(filter)
        ]);

        if (unreadOnly && notifications.length > 0) {
            const unreadIds = notifications
                .filter(n => !n.isRead)
                .map(n => n._id);

            if (unreadIds.length > 0) {
                await Notification.updateMany(
                    { _id: { $in: unreadIds } },
                    { $set: { isRead: true } }
                );
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                notifications,
                pagination: {
                    total: totalCount,
                    page: unreadOnly ? 1 : page,
                    limit,
                    totalPages: Math.ceil(totalCount / limit),
                    hasNextPage: unreadOnly ? false : page * limit < totalCount
                }
            }
        });

    } catch (error) {
        next(error);
    }
};


// ── Admin: POST /admin/push-subscription ─────────────────────────────────────
exports.saveAdminPushSubscription = async (req, res, next) => {
    try {
        const { subscription } = req.body;
        const adminId = req.employee._id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                success: false,
                message: "Valid push subscription object is required"
            });
        }

        await Employee.findByIdAndUpdate(adminId, {
            $set: { pushSubscription: subscription }
        });

        return res.status(200).json({
            success: true,
            message: "Push subscription saved"
        });

    } catch (error) {
        next(error);
    }
};


// Controller to send payment reminder to a specific member
exports.sendCollectionReminder = async (req, res, next) => {
    try {
        const { userId, groupId, amount } = req.body;

        if (!userId || !groupId || !amount) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields (userId, groupId, amount)"
            });
        }

        const group = await Groups.findById(groupId).select("name currentMonth").lean();
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        const io = req.app.get("io");
        const title = "Payment Reminder ⏰";
        const body = `Reminder: You have a pending contribution of ₹${amount} for group "${group.name}" (Month ${group.currentMonth}). Please arrange for payment.`;

        // Trigger the push notification, DB save, and socket event
        await notifyMember(userId, title, body, "PAYMENT_REMINDER", io, groupId);

        return res.status(200).json({
            success: true,
            message: "Reminder sent successfully"
        });

    } catch (error) {
        next(error);
    }
};


//controller to update bid terms
exports.updateBidTerms = async (req, res, next) => {
    try {
        const { roundId } = req.params;
        const { minBid, maxBid, bidMultiple, updateGroupDefaults } = req.body;

        if (!mongoose.Types.ObjectId.isValid(roundId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid round ID"
            });
        }

        // ── Validate new terms ────────────────────────────────────────────────
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

        if (minBid <= 0 || maxBid <= 0 || bidMultiple < 1) {
            return res.status(400).json({
                success: false,
                message: "minBid and maxBid must be greater than zero. bidMultiple must be at least 1"
            });
        }

        if (minBid >= maxBid) {
            return res.status(400).json({
                success: false,
                message: "minBid must be less than maxBid"
            });
        }

        // ── Fetch and validate round ──────────────────────────────────────────
        const round = await BiddingRound.findById(roundId);

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        // Only PENDING rounds can have their terms updated.
        // Once OPEN the bidding has started — members may have already bid.
        if (round.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Cannot update terms. Round is already in '${round.status}' state. Terms can only be changed before the round opens.`
            });
        }

        // ── Update terms on the round ─────────────────────────────────────────
        round.minBid = minBid;
        round.maxBid = maxBid;
        round.bidMultiple = bidMultiple;
        await round.save();

        // ── Optionally update group defaultBidTerms ───────────────────────────
        if (updateGroupDefaults === true) {
            await Groups.findByIdAndUpdate(round.groupId, {
                $set: {
                    "defaultBidTerms.minBid": minBid,
                    "defaultBidTerms.maxBid": maxBid,
                    "defaultBidTerms.bidMultiple": bidMultiple
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: updateGroupDefaults
                ? "Bid terms updated for this round and saved as new group defaults for all future rounds"
                : "Bid terms updated for this round only",
            data: {
                roundId: round._id,
                monthNumber: round.monthNumber,
                minBid,
                maxBid,
                bidMultiple
            }
        });

    } catch (error) {
        next(error);
    }
};


// controller to get current cash in hand of an approved employee.
exports.getEmployeeCashInHand = async (req, res, next) => {
    try {
        const { employeeId } = req.params;

        // 1. Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID"
            });
        }

        const employeeObjId = new mongoose.Types.ObjectId(employeeId);

        // 2. Fetch the employee details to ensure they exist (Added "role" to select)
        const employee = await Employee.findById(employeeId)
            .select("name phoneNumber approvalStatus role")
            .lean();

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // 3. Ensure it's an approved employee only, not an admin
        if (employee.approvalStatus !== "APPROVED" || employee.role !== "EMPLOYEE") {
            return res.status(403).json({
                success: false,
                message: "Employee not authorized"
            });
        }

        // 4. Run all four aggregations in parallel specifically for this employee
        const [
            collectedAgg,
            paidOutAgg,
            transfersSentAgg,
            transfersReceivedAgg
        ] = await Promise.all([
            // Total COMPLETED contributions this employee collected
            Transaction.aggregate([
                {
                    $match: {
                        handledBy: employeeObjId,
                        type: "CONTRIBUTION",
                        status: "COMPLETED"
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),

            // Total COMPLETED winner payouts this employee paid out
            Transaction.aggregate([
                {
                    $match: {
                        handledBy: employeeObjId,
                        type: "WINNER_PAYOUT",
                        status: "COMPLETED"
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),

            // Total CONFIRMED cash this employee sent to others
            CashTransfer.aggregate([
                {
                    $match: {
                        fromEmployeeId: employeeObjId,
                        status: "CONFIRMED"
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),

            // Total CONFIRMED cash this employee received from others
            CashTransfer.aggregate([
                {
                    $match: {
                        toEmployeeId: employeeObjId,
                        status: "CONFIRMED"
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ])
        ]);

        // 5. Extract totals safely and handle large numbers/precision
        const collected = Number(collectedAgg[0]?.total || 0);
        const paidOut = Number(paidOutAgg[0]?.total || 0);
        const transfersSent = Number(transfersSentAgg[0]?.total || 0);
        const transfersReceived = Number(transfersReceivedAgg[0]?.total || 0);

        // 6. Calculate net cash in hand safely, forcing precision to prevent floating-point errors
        const rawCashInHand = collected - paidOut - transfersSent + transfersReceived;
        const cashInHand = Math.max(0, Number(rawCashInHand.toFixed(2)));

        return res.status(200).json({
            success: true,
            data: {
                _id: employee._id,
                name: employee.name,
                phoneNumber: employee.phoneNumber,
                collected,            // total contributions collected
                paidOut,              // total winner payouts made
                transfersSent,        // cash handed to other employees
                transfersReceived,    // cash received from other employees
                cashInHand            // net physical cash in hand right now
            }
        });

    } catch (error) {
        next(error);
    }
};
