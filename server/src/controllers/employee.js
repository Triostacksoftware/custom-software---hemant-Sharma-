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


// Controller to log a transaction after employee physically collects/delivers the amount.
exports.logTransaction = async (req, res, next) => {
    try {

        const {
            groupId, userId, monthNumber,
            amount, paymentMode, remarks, handledAt, type
        } = req.body;

        const employeeId = req.employee._id;

        //Basic validation
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

        if (!["CONTRIBUTION", "WINNER_PAYOUT"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction type"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId or userId"
            });
        }

        // Fetch and validate group
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

        if (monthNumber !== group.currentMonth) {
            return res.status(400).json({
                success: false,
                message: "Invalid month number for this group"
            });
        }

        //Fetch and validate user
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const member = group.members.find(
            m => m.userId.toString() === userId
        );

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "User is not a member of this group"
            });
        }

        //Fetch and validate bidding round
        const round = await BiddingRound.findOne({ groupId, monthNumber });

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

        //CONTRIBUTION: validate amount does not exceed remaining balance
        if (type === "CONTRIBUTION") {

            if (round.winnerUserId.toString() === userId) {
                return res.status(400).json({
                    success: false,
                    message: "Winner does not pay contribution"
                });
            }

            // FIX: count only COMPLETED transactions as "already paid".
            const completedContributions = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "CONTRIBUTION",
                status: "COMPLETED"     //only verified/completed payments
            }).select("amount").lean();

            const completedTotal = completedContributions.reduce(
                (sum, t) => sum + t.amount, 0
            );

            if (completedTotal + amount > round.payablePerMember) {
                return res.status(400).json({
                    success: false,
                    message: `Contribution limit exceeded. Completed so far: ${completedTotal}/${round.payablePerMember}`
                });
            }

        }

        //WINNER_PAYOUT: validate amount does not exceed remaining payout
        if (type === "WINNER_PAYOUT") {

            if (round.winnerUserId.toString() !== userId) {
                return res.status(400).json({
                    success: false,
                    message: "Payout can only be made to the winner"
                });
            }

            //count only COMPLETED payouts
            const completedPayouts = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "WINNER_PAYOUT",
                status: "COMPLETED"     //only verified/completed payouts
            }).select("amount").lean();

            const completedTotal = completedPayouts.reduce(
                (sum, t) => sum + t.amount, 0
            );

            if (completedTotal + amount > round.winnerReceivableAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Winner payout exceeds receivable amount. Completed so far: ${completedTotal}/${round.winnerReceivableAmount}`
                });
            }

        }

        //Find the matching USER_CONFIRMED transaction to verify
        // The member created this record when they confirmed the payment.
        // We match by amount so each partial installment maps to its own record.
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
                message: "No matching member confirmation found for this amount. Ensure the member has confirmed this exact amount."
            });
        }

        //Mark transaction as COMPLETED
        // paymentMode and handledBy are already stored from the member's
        // confirmation; the employee can override them here if needed.
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


// Controller to get all pending transactions (contribution + winner payout) for a group/month.
// Used by the employee side to know who still needs to pay / receive payout,
// and which USER_CONFIRMED transactions are waiting for employee verification.
exports.getTransactionPendingMembers = async (req, res, next) => {
    try {

        const { groupId } = req.params;

        // Validate groupId
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId"
            });
        }

        // Fetch group with member details
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

        // Fetch current bidding round
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

        if (round.status !== "PAYMENT_OPEN") {
            return res.status(400).json({
                success: false,
                message: "Payments are not open yet"
            });
        }

        const payablePerMember = round.payablePerMember;
        const winnerId = round.winnerUserId.toString();
        const winnerReceivableAmount = round.winnerReceivableAmount;

        // Filter to ACTIVE members only
        const activeMembers = members.filter(m => m.status === "ACTIVE");

        // Sum only COMPLETED transactions (truly collected amounts)
        const completedAgg = await Transaction.aggregate([
            {
                $match: {
                    groupId: new mongoose.Types.ObjectId(groupId),
                    monthNumber: currentMonth,
                    type: { $in: ["CONTRIBUTION", "WINNER_PAYOUT"] },
                    status: "COMPLETED"     // only count verified/completed payments
                }
            },
            {
                $group: {
                    _id: { userId: "$userId", type: "$type" },
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        // Build lookup maps from the COMPLETED aggregate
        const completedContributionMap = new Map(); // userId -> total completed contribution
        let completedPayoutTotal = 0;

        completedAgg.forEach(tx => {
            const userId = tx._id.userId.toString();
            if (tx._id.type === "CONTRIBUTION") {
                completedContributionMap.set(userId, tx.totalPaid);
            }
            if (tx._id.type === "WINNER_PAYOUT") {
                completedPayoutTotal = tx.totalPaid;
            }
        });

        // Fetch USER_CONFIRMED transactions waiting for employee verification
        // Returned per-member so the employee can click and verify each one.
        const userConfirmedTxns = await Transaction.find({
            groupId,
            monthNumber: currentMonth,
            type: { $in: ["CONTRIBUTION", "WINNER_PAYOUT"] },
            status: "USER_CONFIRMED"
        })
            .select("_id userId type amount paymentMode handledBy createdAt")
            .lean();

        // Group USER_CONFIRMED transactions by userId for quick lookup
        const userConfirmedMap = new Map(); // userId -> [{ _id, amount, paymentMode, ... }]

        userConfirmedTxns.forEach(tx => {
            const uid = tx.userId.toString();
            if (!userConfirmedMap.has(uid)) userConfirmedMap.set(uid, []);
            userConfirmedMap.get(uid).push({
                transactionId: tx._id,
                amount: tx.amount,
                paymentMode: tx.paymentMode,
                handledBy: tx.handledBy,
                createdAt: tx.createdAt
            });
        });

        //Build contribution pending members list
        // A member appears here if their COMPLETED total < payablePerMember OR
        // if they have USER_CONFIRMED transactions still awaiting verification.
        const contributionPendingMembers = activeMembers.reduce((acc, member) => {

            const memberId = member.userId._id.toString();

            // Winner never pays contribution
            if (memberId === winnerId) return acc;

            const completedPaid = completedContributionMap.get(memberId) || 0;
            const remainingAmount = payablePerMember - completedPaid;
            const pendingConfirmations = userConfirmedMap.get(memberId) || [];

            // Include member if there is still money to collect OR
            // if they have confirmations waiting for employee action
            if (remainingAmount > 0 || pendingConfirmations.length > 0) {
                acc.push({
                    type: "CONTRIBUTION",
                    userId: member.userId._id,
                    name: member.userId.name,
                    phoneNumber: member.userId.phoneNumber,
                    approvalStatus: member.userId.approvalStatus,
                    totalPaidThisMonth: completedPaid,        // COMPLETED only
                    remainingAmount,                          // based on COMPLETED only
                    pendingConfirmations,                     // USER_CONFIRMED waiting for employee
                    hasWon: member.hasWon,
                    winningMonth: member.winningMonth
                });
            }

            return acc;

        }, []);

        //Build winner payout pending
        let payoutPending = null;
        const winnerConfirmations = userConfirmedMap.get(winnerId) || [];
        const winnerRemainingAmount = winnerReceivableAmount - completedPayoutTotal;

        if (winnerRemainingAmount > 0 || winnerConfirmations.length > 0) {

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
                    totalPaidToWinner: completedPayoutTotal,   // COMPLETED only
                    remainingAmount: winnerRemainingAmount,  // based on COMPLETED only
                    pendingConfirmations: winnerConfirmations,   // USER_CONFIRMED waiting for employee
                    payoutAmount: winnerReceivableAmount
                };
            }

        }

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


//controller to get transaction history logged by the employee
exports.getEmployeeTransactionHistory = async (req, res, next) => {
    try {

        const employeeId = req.employee._id;

        // Extract query parameters
        let {
            page = 1,
            limit = 20,
            groupId,
            memberId,
            type,
            fromDate,
            toDate
        } = req.query;

        // Convert pagination values to numbers
        page = parseInt(page);
        limit = parseInt(limit);
        if (page <= 0) page = 1;
        if (limit <= 0) limit = 20;

        const skip = (page - 1) * limit;

        //Base filter - transactions handled by this employee
        const filter = {
            handledBy: employeeId,
            status: "COMPLETED"
        };

        // Optional Filter: groupId
        if (groupId) {
            if (!mongoose.Types.ObjectId.isValid(groupId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid groupId"
                });
            }

            filter.groupId = new mongoose.Types.ObjectId(groupId);
        }

        // Optional Filter: memberId
        if (memberId) {
            if (!mongoose.Types.ObjectId.isValid(memberId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid memberId"
                });
            }

            filter.userId = new mongoose.Types.ObjectId(memberId);
        }

        // Optional Filter: transaction type
        if (type) {

            if (!["CONTRIBUTION", "WINNER_PAYOUT"].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid transaction type"
                });
            }

            filter.type = type;
        }

        // Optional Filter: Date range
        if (fromDate || toDate) {

            filter.handledAt = {};

            if (fromDate) {

                const start = new Date(fromDate);

                if (isNaN(start)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid fromDate"
                    });
                }

                filter.handledAt.$gte = start;
            }

            if (toDate) {

                const end = new Date(toDate);

                if (isNaN(end)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid toDate"
                    });
                }

                filter.handledAt.$lte = end;
            }
        }

        // Count total transactions (for pagination)
        const total = await Transaction.countDocuments(filter);

        // Fetch paginated transactions
        const transactions = await Transaction.find(filter)

            .populate({
                path: "groupId",
                select: "name"
            })

            .populate({
                path: "userId",
                select: "name phoneNumber"
            })

            .populate({
                path: "handledBy",
                select: "name"
            })

            .sort({ handledAt: -1 }) // newest first

            .skip(skip)
            .limit(limit)

            .lean();

        // Calculate total pages
        const pages = Math.ceil(total / limit);

        // Send response
        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    total,
                    page,
                    limit,
                    pages
                }
            }
        });

    } catch (error) {
        next(error);

    }
};