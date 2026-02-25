const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Employee = require("../models/employee.js");
const Groups = require("../models/group.js");
const Transaction = require("../models/transaction.js");
const User = require("../models/user.js");
const BiddingRound = require("../models/biddingRound.js");

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

//controller function to register a new user
exports.employeeSignup = async (req, res, next) => {

    try {
        const { name, phoneNumber, password } = req.body;

        //form data validation
        if (!name || !phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if employee already exists
        if (await Employee.exists({ phoneNumber })) {
            return res.status(409).json({ error: "Employee already exists" });
        }

        //hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await Employee.create({
            name,
            phoneNumber,
            password: hashedPassword,
            approvalStatus: "PENDING"
        });

        res.status(201).json({ message: "Signup successful. Awaiting admin approval", success: true });

    } catch (error) {

        next(error);
    }
}


//create login token using jwt
function generateAccessToken(id, name) {
    return jwt.sign(
        { employeeId: id, name: name },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
    );
}

//controller function for employee login
exports.employeeLogin = async (req, res, next) => {
    try {
        const { phoneNumber, password } = req.body;

        //form data validation
        if (!phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if the employee exists or not
        const employee = await Employee.findOne({ phoneNumber });
        if (!employee) {
            return res.status(409).json({ error: "Employee does not exist" });
        }

        if (employee.approvalStatus !== "APPROVED") {
            return res.status(403).json({ error: "Awaiting approval from admin" });
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


//controller to log contributions of members
exports.logContribution = async (req, res, next) => {
    try {

        const { groupId, userId, monthNumber, amountPaid, paymentMode, remarks, collectedAt } = req.body;

        const employeeId = req.employee._id; // from JWT

        //basic validation
        if (!groupId || !userId || !monthNumber || !amountPaid || !paymentMode) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (amountPaid <= 0) {
            return res.status(400).json({
                success: false,
                message: "Contribution amount must be greater than 0"
            });
        }

        //validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId or userId"
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

        //group must be ACTIVE
        if (group.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Contributions allowed only for ACTIVE groups"
            });
        }

        //month validation
        if (monthNumber !== group.currentMonth) {
            return res.status(400).json({
                success: false,
                message: "Invalid month number for this group"
            });
        }

        //check user's existence
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        //check member exists in group
        const isMember = group.members.some(
            member => member.userId.toString() === userId
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "User is not a member of this group"
            });
        }

        // handling the edge case - if the total contribution of a member is > monthly contribution limit
        const userTransactions = await Transaction.find({
            groupId,
            userId,
            monthNumber,
            type: "CONTRIBUTION"
        }).select("amount").lean();

        const existingTotal = userTransactions.reduce((sum, t) => sum + t.amount, 0);

        if (existingTotal + amountPaid > group.monthlyContribution) {
            return res.status(400).json({
                success: false,
                message: `Limit exceeded. Paid: ${existingTotal}/${group.monthlyContribution}`
            });
        }

        //create contribution record
        await Transaction.create({
            groupId,
            userId,
            monthNumber,
            amount: amountPaid,
            type: "CONTRIBUTION",
            paymentMode,
            handledBy: employeeId,
            remarks,
            handledAt: collectedAt
        });

        return res.status(201).json({
            success: true,
            message: "Contribution logged successfully"
        });

    } catch (error) {

        next(error);

    }
};


//controller to fetch employee dashboard
exports.getEmployeeDashboard = async (req, res, next) => {
    try {

        // 1️⃣ Fetch all ACTIVE groups
        const activeGroups = await Groups.find({ status: "ACTIVE" }).lean();

        if (!activeGroups.length) {
            return res.status(200).json({
                success: true,
                dashboard: {
                    totalActiveGroups: 0,
                    totalMembers: 0,
                    totalCollectionCurrentMonth: 0,
                    pendingContributionCount: 0,
                    groups: []
                }
            });
        }

        const groupIds = activeGroups.map(g => g._id);

        // 2️⃣ Aggregate current month contributions per group
        const contributionAgg = await Transaction.aggregate([
            {
                $match: {
                    groupId: { $in: groupIds },
                    type: "CONTRIBUTION"
                }
            },
            {
                $group: {
                    _id: {
                        groupId: "$groupId",
                        monthNumber: "$monthNumber"
                    },
                    totalCollected: { $sum: "$amount" },
                    paidMembers: { $addToSet: "$userId" }
                }
            }
        ]);

        // Map: groupId_month -> { totalCollected, paidCount }
        const contributionMap = {};
        contributionAgg.forEach(item => {
            const key = `${item._id.groupId}_${item._id.monthNumber}`;
            contributionMap[key] = {
                totalCollected: item.totalCollected,
                paidMembersCount: item.paidMembers.length
            };
        });

        // 3️⃣ Fetch bidding rounds for current months
        const biddingRounds = await BiddingRound.find({
            groupId: { $in: groupIds }
        }).lean();

        const biddingMap = {};
        biddingRounds.forEach(round => {
            const key = `${round.groupId}_${round.monthNumber}`;
            biddingMap[key] = round;
        });

        let totalMembers = 0;
        let totalCollectionCurrentMonth = 0;
        let totalPendingCount = 0;

        const groupDetails = [];

        for (const group of activeGroups) {

            const totalMembersInGroup = group.members.length;
            totalMembers += totalMembersInGroup;

            const key = `${group._id}_${group.currentMonth}`;
            const contributionData = contributionMap[key] || {
                totalCollected: 0,
                paidMembersCount: 0
            };

            const pendingMembers =
                totalMembersInGroup - contributionData.paidMembersCount;

            const expectedAmount =
                totalMembersInGroup * group.monthlyContribution;

            const progressPercentage =
                expectedAmount === 0
                    ? 0
                    : Number(
                        ((contributionData.totalCollected / expectedAmount) * 100).toFixed(2)
                    );

            totalCollectionCurrentMonth += contributionData.totalCollected;
            totalPendingCount += pendingMembers;

            const bidding = biddingMap[key];

            groupDetails.push({
                groupId: group._id,
                name: group.name,
                currentMonth: group.currentMonth,
                totalMembers: totalMembersInGroup,
                totalCollected: contributionData.totalCollected,
                pendingMembersCount: pendingMembers,
                collectionProgressPercentage: progressPercentage,
                bidding: bidding ? {
                    status: bidding.status,
                    winningBidAmount: bidding.winningBidAmount,
                    winnerUserId: bidding.winnerUserId,
                    totalPoolAmount: bidding.totalPoolAmount,
                    dividendPerMember: bidding.dividendPerMember,
                    payoutAmount: bidding.payoutAmount
                } : {
                    status: "NOT_CREATED",
                    winningBidAmount: 0,
                    winnerUserId: null,
                    totalPoolAmount: 0,
                    dividendPerMember: 0,
                    payoutAmount: 0
                }
            });
        }

        return res.status(200).json({
            success: true,
            dashboard: {
                totalActiveGroups: activeGroups.length,
                totalMembers,
                totalCollectionCurrentMonth,
                pendingContributionCount: totalPendingCount,
                groups: groupDetails
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to get the list of active groups
exports.getActiveGroups = async (req, res, next) => {
    try {

        const groups = await Groups.find({ status: "ACTIVE" })
            .select("_id name currentMonth monthlyContribution")
            .sort({ createdAt: -1 })   // newest first
            .lean();

        return res.status(200).json({
            success: true,
            count: groups.length,
            groups
        });

    } catch (error) {
        next(error);
    }
};

//controller to get pending for payment members(per group/per month)
exports.getContributionPendingMembers = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ success: false, message: "Invalid groupId" });
        }

        // fetch group and populate user details in one go
        const group = await Groups.findById(groupId)
            .populate("members.userId", "name phoneNumber approvalStatus")
            .lean();

        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        if (group.status !== "ACTIVE") {
            return res.status(400).json({ success: false, message: "Group is not ACTIVE" });
        }

        const { currentMonth, monthlyContribution, members, name: groupName } = group;
        const activeMembers = members.filter(m => m.status === "ACTIVE");

        // fetch all contributions for this group/month in one trip
        const contributions = await Transaction.aggregate([
            {
                $match: {
                    groupId: new mongoose.Types.ObjectId(groupId),
                    monthNumber: currentMonth,
                    type: "CONTRIBUTION"
                }
            },
            {
                $group: {
                    _id: "$userId",
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        // convert contributions to a Map for O(1) lookup
        const contributionMap = new Map(contributions.map(c => [c._id.toString(), c.totalPaid]));

        // filter and map pending for payment members in a single pass
        const pendingMembers = activeMembers.reduce((acc, member) => {
            const paid = contributionMap.get(member.userId._id.toString()) || 0;

            if (paid < monthlyContribution) {
                acc.push({
                    userId: member.userId._id,
                    name: member.userId.name,
                    phoneNumber: member.userId.phoneNumber,
                    approvalStatus: member.userId.approvalStatus,
                    totalPaidThisMonth: paid,
                    remainingAmount: monthlyContribution - paid,
                    hasWon: member.hasWon,
                    winningMonth: member.winningMonth
                });
            }
            return acc;
        }, []);

        return res.status(200).json({
            success: true,
            groupId: group._id,
            groupName,
            currentMonth,
            monthlyContribution,
            pendingCount: pendingMembers.length,
            pendingMembers
        });

    } catch (error) {
        next(error);
    }
};