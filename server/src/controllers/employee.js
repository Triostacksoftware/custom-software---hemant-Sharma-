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


//controller to log transaction of members
exports.logTransaction = async (req, res, next) => {
    try {

        const { groupId, userId, monthNumber, amount, paymentMode, remarks, handledAt, type } = req.body;

        const employeeId = req.employee._id;

        //basic validation
        if (!groupId || !userId || !monthNumber || !amount || !paymentMode || !type) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than 0"
            });
        }

        //validate transaction type
        if (!["CONTRIBUTION", "WINNER_PAYOUT"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction type"
            });
        }

        //validate object Ids
        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId or userId"
            });
        }

        //fetch groups
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
                message: "Transactions allowed only for ACTIVE groups"
            });
        }

        //validate month
        if (monthNumber !== group.currentMonth) {
            return res.status(400).json({
                success: false,
                message: "Invalid month number for this group"
            });
        }

        //fetch user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        //check member existence in group
        const member = group.members.find(
            m => m.userId.toString() === userId
        );

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "User is not a member of this group"
            });
        }


        //fetch bidding round
        //Ensure transactions allowed only after bidding
        const round = await BiddingRound.findOne({
            groupId,
            monthNumber
        });

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        if (round.status !== "PAYMENT_OPEN") {
            return res.status(400).json({
                success: false,
                message: "Transactions allowed only during PAYMENT_OPEN stage"
            });
        }

        //Contribution logic
        if (type === "CONTRIBUTION") {

            // Winner should not pay contribution
            if (round.winnerUserId.toString() === userId) {
                return res.status(400).json({
                    success: false,
                    message: "Winner does not pay contribution"
                });
            }

            // Fetch previous contributions
            const userTransactions = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "CONTRIBUTION"
            }).select("amount").lean();

            const existingTotal = userTransactions.reduce(
                (sum, t) => sum + t.amount,
                0
            );

            // Validate contribution limit
            if (existingTotal + amount > round.payablePerMember) {
                return res.status(400).json({
                    success: false,
                    message: `Contribution limit exceeded. Paid: ${existingTotal}/${round.payablePerMember}`
                });
            }

        }

        //Winner Payout logic
        if (type === "WINNER_PAYOUT") {

            // Only winner can receive payout
            if (round.winnerUserId.toString() !== userId) {
                return res.status(400).json({
                    success: false,
                    message: "Payout can only be made to the winner"
                });
            }

            const existingPayouts = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "WINNER_PAYOUT"
            }).select("amount").lean();

            const totalPaid = existingPayouts.reduce(
                (sum, t) => sum + t.amount, 0
            );

            const winnerReceivableAmount = round.winnerReceivableAmount;

            if (totalPaid + amount > winnerReceivableAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Winner payout exceeds receivable amount. Paid: ${totalPaid}/${winnerReceivableAmount}`
                });
            }

        }

        //verify user confirmation
        const pendingTransaction = await Transaction.findOne({
            groupId,
            userId,
            monthNumber,
            amount,
            type,
            status: "USER_CONFIRMED"
        });

        if (!pendingTransaction) {
            return res.status(400).json({
                success: false,
                message: "User has not confirmed this transaction"
            });
        }

        //update transaction after employee verification
        pendingTransaction.paymentMode = paymentMode;
        pendingTransaction.handledBy = employeeId;
        pendingTransaction.handledAt = handledAt || new Date();
        pendingTransaction.remarks = remarks;
        pendingTransaction.status = "COMPLETED";

        await pendingTransaction.save();

        return res.status(201).json({
            success: true,
            message: "Transaction logged successfully"
        });

    } catch (error) {
        next(error);

    }
};


//controller to fetch employee dashboard
exports.getEmployeeDashboard = async (req, res, next) => {
    try {

        //Fetch all ACTIVE groups
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

        //Aggregate current month contributions per group
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

        const contributionMap = {};
        contributionAgg.forEach(item => {
            const key = `${item._id.groupId}_${item._id.monthNumber}`;
            contributionMap[key] = {
                totalCollected: item.totalCollected,
                paidMembersCount: item.paidMembers.length
            };
        });

        //Fetch bidding rounds
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

            const bidding = biddingMap[key];

            let expectedAmount = 0;
            let pendingMembers = 0;

            if (bidding && bidding.status === "PAYMENT_OPEN") {

                const winnerId = bidding.winnerUserId?.toString();

                //Winner excluded from contributors
                const contributorCount = group.members.filter(
                    m => m.userId.toString() !== winnerId && m.status === "ACTIVE"
                ).length;

                //Expected amount based on payablePerMember
                expectedAmount = contributorCount * bidding.payablePerMember;

                pendingMembers =
                    contributorCount - contributionData.paidMembersCount;

            }

            const progressPercentage =
                expectedAmount === 0
                    ? 0
                    : Number(
                        ((contributionData.totalCollected / expectedAmount) * 100).toFixed(2)
                    );

            totalCollectionCurrentMonth += contributionData.totalCollected;
            totalPendingCount += pendingMembers;

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
                    winnerReceivableAmount: bidding.winnerReceivableAmount
                } : {
                    status: "NOT_CREATED",
                    winningBidAmount: 0,
                    winnerUserId: null,
                    totalPoolAmount: 0,
                    dividendPerMember: 0,
                    winnerReceivableAmount: 0
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


//controller to get all pending transactions (contribution + winner payout) for a group/month
exports.getTransactionPendingMembers = async (req, res, next) => {
    try {

        const { groupId } = req.params;

        //validate groupId
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId"
            });
        }

        //fetch group member details
        const group = await Groups.findById(groupId)
            .populate("members.userId", "name phoneNumber approvalStatus")
            .lean();

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        if (group.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Group is not ACTIVE"
            });
        }

        const { currentMonth, members, name: groupName } = group;

        //fetch current bidding round
        const round = await BiddingRound.findOne({
            groupId,
            monthNumber: currentMonth
        }).lean();

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        // Payments allowed only when PAYMENT_OPEN
        if (round.status !== "PAYMENT_OPEN") {
            return res.status(400).json({
                success: false,
                message: "Payments are not open yet"
            });
        }

        const payablePerMember = round.payablePerMember;
        const winnerId = round.winnerUserId.toString();
        const winnerReceivableAmount = round.winnerReceivableAmount;

        //filter ACTIVE members
        const activeMembers = members.filter(m => m.status === "ACTIVE");

        // Fetch all transactions for this group/month (CONTRIBUTION + WINNER_PAYOUT)
        const transactions = await Transaction.aggregate([
            {
                $match: {
                    groupId: new mongoose.Types.ObjectId(groupId),
                    monthNumber: currentMonth,
                    type: { $in: ["CONTRIBUTION", "WINNER_PAYOUT"] }
                }
            },
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        type: "$type"
                    },
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        //convert transaction results into lookup maps
        const contributionMap = new Map();
        let winnerPayoutPaid = 0;

        transactions.forEach(tx => {

            const userId = tx._id.userId.toString();
            const type = tx._id.type;

            if (type === "CONTRIBUTION") {
                contributionMap.set(userId, tx.totalPaid);
            }

            if (type === "WINNER_PAYOUT") {
                winnerPayoutPaid = tx.totalPaid;
            }

        });

        // Determine contribution pending members
        const contributionPendingMembers = activeMembers.reduce((acc, member) => {

            const memberId = member.userId._id.toString();

            // Skip winner (winner does not contribute)
            if (memberId === winnerId) {
                return acc;
            }

            const paid = contributionMap.get(memberId) || 0;

            if (paid < payablePerMember) {

                acc.push({
                    type: "CONTRIBUTION",
                    userId: member.userId._id,
                    name: member.userId.name,
                    phoneNumber: member.userId.phoneNumber,
                    approvalStatus: member.userId.approvalStatus,
                    totalPaidThisMonth: paid,
                    remainingAmount: payablePerMember - paid,
                    hasWon: member.hasWon,
                    winningMonth: member.winningMonth
                });

            }

            return acc;

        }, []);

        //Determine payout pending for winner
        let payoutPending = null;

        if (winnerReceivableAmount && winnerPayoutPaid < winnerReceivableAmount) {

            const winnerMember = activeMembers.find(
                m => m.userId._id.toString() === winnerId
            );

            if (winnerMember) {

                payoutPending = {
                    type: "WINNER_PAYOUT",
                    userId: winnerMember.userId._id,
                    name: winnerMember.userId.name,
                    phoneNumber: winnerMember.userId.phoneNumber,
                    approvalStatus: winnerMember.userId.approvalStatus,
                    totalPaidToWinner: winnerPayoutPaid,
                    remainingAmount: winnerReceivableAmount - winnerPayoutPaid,
                    payoutAmount: winnerReceivableAmount
                };

            }

        }

        // Final Response
        return res.status(200).json({
            success: true,
            groupId: group._id,
            groupName,
            currentMonth,
            payablePerMember,
            contributionPendingCount: contributionPendingMembers.length,
            contributionPendingMembers,
            payoutPending
        });

    } catch (error) {
        next(error);
    }
};