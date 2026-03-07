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
    // try {
    //     const [
    //         groupTotal,
    //         groupActive,
    //         groupDraft,
    //         groupCompleted,

    //         userTotal,
    //         userPending,
    //         userApproved,
    //         userRejected,

    //         employeeTotal,
    //         employeePending,
    //         employeeApproved,
    //         employeeRejected,

    //     ] = await Promise.all([
    //         //groups
    //         Groups.countDocuments(),
    //         Groups.countDocuments({ status: "ACTIVE" }),
    //         Groups.countDocuments({ status: "DRAFT" }),
    //         Groups.countDocuments({ status: "COMPLETED" }),

    //         //users
    //         User.countDocuments(),
    //         User.countDocuments({ approvalStatus: "PENDING" }),
    //         User.countDocuments({ approvalStatus: "APPROVED" }),
    //         User.countDocuments({ approvalStatus: "REJECTED" }),

    //         //employees
    //         Employee.countDocuments(),
    //         Employee.countDocuments({ approvalStatus: "PENDING" }),
    //         Employee.countDocuments({ approvalStatus: "APPROVED" }),
    //         Employee.countDocuments({ approvalStatus: "REJECTED" }),

    //     ]);

    //     return res.status(200).json({
    //         success: true,
    //         data: {
    //             groups: {
    //                 total: groupTotal,
    //                 active: groupActive,
    //                 draft: groupDraft,
    //                 completed: groupCompleted,
    //             },
    //             users: {
    //                 total: userTotal,
    //                 pending: userPending,
    //                 approved: userApproved,
    //                 rejected: userRejected,
    //             },
    //             employees: {
    //                 total: employeeTotal,
    //                 pending: employeePending,
    //                 approved: employeeApproved,
    //                 rejected: employeeRejected,
    //             },
    //         },
    //     });

    // } catch (error) {

    //     next(error);
    // }


    //optimized approach
    try {
        // run 3 parallel aggregations (one for each collection)
        const [groupStats, userStats, employeeStats] = await Promise.all([
            Groups.aggregate([
                {
                    $facet: {
                        total: [{ $count: "count" }],
                        active: [{ $match: { status: "ACTIVE" } }, { $count: "count" }],
                        draft: [{ $match: { status: "DRAFT" } }, { $count: "count" }],
                        completed: [{ $match: { status: "COMPLETED" } }, { $count: "count" }],
                    },
                },
            ]),

            User.aggregate([
                {
                    $facet: {
                        total: [{ $count: "count" }],
                        pending: [{ $match: { approvalStatus: "PENDING" } }, { $count: "count" }],
                        approved: [{ $match: { approvalStatus: "APPROVED" } }, { $count: "count" }],
                        rejected: [{ $match: { approvalStatus: "REJECTED" } }, { $count: "count" }],
                    },
                },
            ]),

            Employee.aggregate([
                {
                    $facet: {
                        total: [{ $count: "count" }],
                        pending: [{ $match: { approvalStatus: "PENDING" } }, { $count: "count" }],
                        approved: [{ $match: { approvalStatus: "APPROVED" } }, { $count: "count" }],
                        rejected: [{ $match: { approvalStatus: "REJECTED" } }, { $count: "count" }],
                    },
                },
            ]),
        ]);

        // Extract results directly
        // aggregate returns an array, so we look at index [0]
        const g = groupStats[0];
        const u = userStats[0];
        const e = employeeStats[0];

        return res.status(200).json({
            success: true,
            data: {
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
                },
            },
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


//controller to get full group details including member financial stats
exports.getGroupDetails = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        //Validate groupId
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID"
            });
        }

        //Fetch group
        const group = await Groups.findById(groupId)
            .populate("members.userId", "name phone")
            .select("-__v")
            .lean();

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        const { members, currentMonth, totalMembers } = group;

        //Fetch all bidding rounds
        //Needed to calculate expected contributions
        const biddingRounds = await BiddingRound.find({ groupId })
            .select("monthNumber payablePerMember winnerUserId")
            .lean();

        // Aggregate all contribution transactions
        // Only COMPLETED contributions are counted
        const contributionAgg = await Transaction.aggregate([
            {
                $match: {
                    groupId: new mongoose.Types.ObjectId(groupId),
                    type: "CONTRIBUTION",
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
                    totalPaid: { $sum: "$amount" },
                    currentMonthPaid: {
                        $sum: {
                            $cond: [
                                { $eq: ["$monthNumber", currentMonth] },
                                "$amount",
                                0
                            ]
                        }
                    },
                    contributionHistory: {
                        $push: {
                            monthNumber: "$monthNumber",
                            amountPaid: "$amount",
                            paymentMode: "$paymentMode",
                            collectedAt: "$handledAt",
                            collectorName: "$collector.name"
                        }
                    }
                }
            }
        ]);

        // Convert aggregation result to map for fast lookup
        const contributionMap = new Map(
            contributionAgg.map(item => [item._id.toString(), item])
        );

        let totalCollected = 0;
        let currentMonthCollection = 0;

        //Build member response
        const membersResponse = members.map(member => {

            const userId = member.userId?._id?.toString();

            const contributionData = contributionMap.get(userId) || {};

            const totalPaid = contributionData.totalPaid || 0;
            const history = contributionData.contributionHistory || [];
            const currentMonthPaid = contributionData.currentMonthPaid || 0;

            totalCollected += totalPaid;
            currentMonthCollection += currentMonthPaid;

            // Calculate expected contribution
            let expectedTillNow = 0;

            biddingRounds.forEach(round => {

                // Skip winner's contribution
                if (round.winnerUserId?.toString() !== userId) {
                    expectedTillNow += round.payablePerMember || 0;
                }

            });

            return {
                userId,
                name: member.userId?.name || "Unknown User",
                phone: member.userId?.phone || null,
                hasWon: member.hasWon,
                winningMonth: member.winningMonth,
                totalPaid,
                totalReceived: member.totalReceived || 0,
                expectedTillNow,
                pendingAmount: Math.max(0, expectedTillNow - totalPaid),
                currentMonthPaid,
                contributionHistory: history
            };

        });

        //Financial summary
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
                    winnersCount
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
                                amount: "$amount",
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


//controller to open bidding
exports.openBidding = async (req, res, next) => {
    try {
        const { groupId } = req.body;

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "Group ID is required"
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

        //ensure no OPEN round exists
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

        // Check if this month round already exists
        const existingRound = await BiddingRound.findOne({
            groupId,
            monthNumber: group.currentMonth
        });

        if (existingRound) {
            return res.status(400).json({
                success: false,
                message: "Bidding already done for this month"
            });
        }

        const totalPoolAmount =
            group.totalMembers * group.monthlyContribution;

        const now = new Date();
        const twoHoursLater = new Date(
            now.getTime() + 2 * 60 * 60 * 1000
        );

        // Create bidding round
        const biddingRound = await BiddingRound.create({
            groupId,
            monthNumber: group.currentMonth,
            totalPoolAmount,
            status: "OPEN",
            startedAt: now,
            endedAt: twoHoursLater
        });

        //Emit socket event
        const io = req.app.get("io");

        io.to(biddingRound._id.toString()).emit("biddingOpened", {
            biddingRoundId: biddingRound._id,
            monthNumber: biddingRound.monthNumber,
            endsAt: biddingRound.endedAt
        });

        return res.status(201).json({
            success: true,
            message: "Bidding opened successfully",
            data: {
                biddingRoundId: biddingRound._id,
                monthNumber: biddingRound.monthNumber,
                endsAt: biddingRound.endedAt
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
        const dividendPerMember = winningBidAmount / totalMembers;
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
        const dividendPerMember = winningBidAmount / totalMembers;
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


//controller to finalize bidding and move group to next month
exports.finalizeBidding = async (req, res, next) => {
    try {

        const { biddingRoundId } = req.body;

        //basic validation
        if (!biddingRoundId) {
            return res.status(400).json({
                success: false,
                message: "Bidding round ID is required"
            });
        }

        //fetch bidding round
        const round = await BiddingRound.findById(biddingRoundId);

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        //ensure round is still in payment stage
        if (round.status !== "PAYMENT_OPEN") {
            return res.status(400).json({
                success: false,
                message: "Bidding cannot be finalized at this stage"
            });
        }

        //fetch group
        const group = await Groups.findById(round.groupId);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Associated group not found"
            });
        }

        // Verify ALL transactions of this round are COMPLETED
        const transactions = await Transaction.find({
            biddingRoundId: round._id
        }).populate("userId", "name phone");

        //edge case: no transactions logged
        if (!transactions.length) {
            return res.status(400).json({
                success: false,
                message: "No transactions found for this round"
            });
        }

        //find pending transactions
        const pendingTransactions = transactions.filter(
            t => t.status !== "COMPLETED"
        );

        //if pending exist return member details
        if (pendingTransactions.length > 0) {

            const pendingMembers = pendingTransactions.map(t => ({
                name: t.userId.name,
                phone: t.userId.phone
            }));

            return res.status(400).json({
                success: false,
                message: "Some member transactions are still pending",
                pendingMembers
            });
        }

        // All transactions completed -> finalize bidding
        round.status = "FINALIZED";
        round.finalizedAt = new Date();

        await round.save();

        // Move group to next month
        group.currentMonth += 1;

        //reset member payment status for next month
        group.members.forEach(member => {
            member.currentPaymentStatus = "PENDING";
        });

        //check if group cycle finished
        if (group.currentMonth > group.totalMonths) {
            group.status = "COMPLETED";
        }

        await group.save();

        // Final success response
        return res.status(200).json({
            success: true,
            message: "Bidding finalized successfully",
            data: {
                groupId: group._id,
                biddingRoundId: round._id,
                nextMonth: group.currentMonth,
                groupStatus: group.status,
                totalMonths: group.totalMonths
            }
        });

    } catch (error) {
        next(error);
    }
};