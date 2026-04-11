const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Employee = require("../models/employee.js");
const Groups = require("../models/group.js");
const Transaction = require("../models/transaction.js");
const User = require("../models/user.js");
const BiddingRound = require("../models/biddingRound.js");
const Notification = require("../models/notification.js");

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
            amount, paymentMode, remarks, type
        } = req.body;

        const employeeId = req.employee._id;

        // ── Basic validation ──────────────────────────────────────────────────
        if (!groupId || !userId || !monthNumber || !amount || !paymentMode || !type) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: groupId, userId, monthNumber, amount, paymentMode, type"
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
                message: "Invalid transaction type. Must be CONTRIBUTION or WINNER_PAYOUT"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId or userId"
            });
        }

        // ── Validate group ────────────────────────────────────────────────────
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
                message: `Month number mismatch. Current month is ${group.currentMonth}`
            });
        }

        // ── Validate user ─────────────────────────────────────────────────────
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

        // ── Validate bidding round ────────────────────────────────────────────
        //
        // Accept both PAYMENT_OPEN (normal months) and ADMIN_ROUND (month 1).
        // Both statuses have pending payments to collect.
        const round = await BiddingRound.findOne({ groupId, monthNumber });

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found for this group and month"
            });
        }

        if (!["PAYMENT_OPEN", "ADMIN_ROUND"].includes(round.status)) {
            return res.status(400).json({
                success: false,
                message: `Transactions not allowed. Round status is '${round.status}'. Must be PAYMENT_OPEN or ADMIN_ROUND`
            });
        }

        // ── Type-specific validations ─────────────────────────────────────────

        if (type === "CONTRIBUTION") {
            // Winner does not pay contribution
            if (round.winnerUserId && round.winnerUserId.toString() === userId) {
                return res.status(400).json({
                    success: false,
                    message: "Winner does not pay contribution"
                });
            }

            // Remaining balance check — count COMPLETED + PENDING transactions
            // to prevent double-initiating beyond the payable amount.
            // PENDING is included so employee can't initiate ₹10000 twice
            // for a member who already has ₹10000 PENDING confirmation.
            const existingTxAgg = await Transaction.aggregate([
                {
                    $match: {
                        groupId: new mongoose.Types.ObjectId(groupId),
                        userId: new mongoose.Types.ObjectId(userId),
                        monthNumber,
                        type: "CONTRIBUTION",
                        status: { $in: ["PENDING", "COMPLETED", "USER_CONFIRMED"] }
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const alreadyAccountedFor = existingTxAgg[0]?.total || 0;

            if (alreadyAccountedFor + amount > round.payablePerMember) {
                const remaining = round.payablePerMember - alreadyAccountedFor;
                return res.status(400).json({
                    success: false,
                    message: `Amount exceeds remaining balance. Remaining: ₹${remaining}`
                });
            }
        }

        if (type === "WINNER_PAYOUT") {
            if (!round.winnerUserId || round.winnerUserId.toString() !== userId) {
                return res.status(400).json({
                    success: false,
                    message: "Payout can only be initiated for the winner of this round"
                });
            }

            const existingTxAgg = await Transaction.aggregate([
                {
                    $match: {
                        groupId: new mongoose.Types.ObjectId(groupId),
                        userId: new mongoose.Types.ObjectId(userId),
                        monthNumber,
                        type: "WINNER_PAYOUT",
                        status: { $in: ["PENDING", "COMPLETED", "USER_CONFIRMED"] }
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const alreadyAccountedFor = existingTxAgg[0]?.total || 0;

            if (alreadyAccountedFor + amount > round.winnerReceivableAmount) {
                const remaining = round.winnerReceivableAmount - alreadyAccountedFor;
                return res.status(400).json({
                    success: false,
                    message: `Amount exceeds remaining payout balance. Remaining: ₹${remaining}`
                });
            }
        }

        // ── Create transaction as PENDING ─────────────────────────────────────
        //
        // Status is PENDING — not COMPLETED yet.
        // Member must confirm this in their dashboard to complete it.
        const transaction = await Transaction.create({
            groupId,
            userId,
            biddingRoundId: round._id,
            monthNumber,
            type,
            amount,
            paymentMode,
            handledBy: employeeId,
            handledAt: new Date(),
            remarks: remarks || null,
            status: "PENDING"
        });

        // TODO: emit socket event to member's personal room so the confirmation
        // request appears in their dashboard in real time.
        // to be implemented in the notifications phase:
        //
        // const io = req.app.get("io");
        // io.to(`user_${userId}`).emit("newTransactionRequest", {
        //     transactionId: transaction._id,
        //     amount,
        //     type,
        //     groupName: group.name,
        //     monthNumber,
        //     paymentMode,
        //     employeeName: req.employee.name
        // });

        return res.status(201).json({
            success: true,
            message: "Transaction initiated. Waiting for member confirmation.",
            data: {
                transactionId: transaction._id,
                amount,
                type,
                status: "PENDING"
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to fetch employee dashboard
exports.getEmployeeDashboard = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // ── Fetch all active groups ───────────────────────────────────────────
        const activeGroups = await Groups.find({ status: "ACTIVE" })
            .select("_id name currentMonth totalMembers members")
            .lean();

        const groupIds = activeGroups.map(g => g._id);

        if (!groupIds.length) {
            return res.status(200).json({
                success: true,
                data: {
                    stats: {
                        totalPendingCollectionThisMonth: 0,
                        totalPendingPayoutThisMonth: 0,
                        todaysCollection: 0,
                        thisMonthsCollection: 0
                    }
                }
            });
        }

        const groupMap = new Map(activeGroups.map(g => [g._id.toString(), g]));

        // ── Run independent queries in parallel ───────────────────────────────
        const [
            paymentRounds,
            collectionStats
        ] = await Promise.all([

            // Payment-phase rounds for current month
            BiddingRound.find({
                groupId: { $in: groupIds },
                status: { $in: ["PAYMENT_OPEN", "ADMIN_ROUND"] }
            })
                .select("_id groupId monthNumber payablePerMember winnerUserId winnerReceivableAmount")
                .lean(),

            // Today's and this month's COMPLETED contribution totals
            Transaction.aggregate([
                {
                    $match: {
                        groupId: { $in: groupIds },
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
            ])
        ]);

        // Filter rounds to current month only
        const activePaymentRounds = paymentRounds.filter(r => {
            const group = groupMap.get(r.groupId.toString());
            return group && r.monthNumber === group.currentMonth;
        });

        // ── Aggregate COMPLETED transactions for active payment rounds ─────────
        const roundIds = activePaymentRounds.map(r => r._id);

        const completedAgg = roundIds.length
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

        // Build lookup map
        const paidMap = new Map();
        completedAgg.forEach(item => {
            const key = `${item._id.biddingRoundId}_${item._id.userId}_${item._id.type}`;
            paidMap.set(key, item.totalPaid);
        });

        // ── Calculate pending totals ──────────────────────────────────────────
        let totalPendingCollectionThisMonth = 0;
        let totalPendingPayoutThisMonth = 0;

        activePaymentRounds.forEach(round => {
            const group = groupMap.get(round.groupId.toString());
            if (!group) return;

            const winnerIdStr = round.winnerUserId?.toString();

            // Pending contributions — all non-winner members
            group.members.forEach(member => {
                const memberIdStr = member.userId.toString();
                if (memberIdStr === winnerIdStr) return;

                const completedKey = `${round._id}_${memberIdStr}_CONTRIBUTION`;
                const completedPaid = paidMap.get(completedKey) || 0;
                const pending = Math.max(0, (round.payablePerMember || 0) - completedPaid);
                totalPendingCollectionThisMonth += pending;
            });

            // Pending payout — winner only
            if (winnerIdStr) {
                const completedKey = `${round._id}_${winnerIdStr}_WINNER_PAYOUT`;
                const completedReceived = paidMap.get(completedKey) || 0;
                const pending = Math.max(0, (round.winnerReceivableAmount || 0) - completedReceived);
                totalPendingPayoutThisMonth += pending;
            }
        });

        const cs = collectionStats[0];

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalPendingCollectionThisMonth,
                    totalPendingPayoutThisMonth,
                    todaysCollection: cs.today[0]?.total || 0,
                    thisMonthsCollection: cs.thisMonth[0]?.total || 0
                }
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


// Controller to get all pending transactions (contribution + winner payout)
// Used by the employee side to know who still needs to pay / receive payout,
exports.getTransactionPendingMembers = async (req, res, next) => {
    try {
        const { search, groupId } = req.query;

        // ── Fetch active groups ───────────────────────────────────────────────
        const groupFilter = { status: "ACTIVE" };
        if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
            groupFilter._id = new mongoose.Types.ObjectId(groupId);
        }

        const groups = await Groups.find(groupFilter)
            .populate("members.userId", "name phoneNumber")
            .select("_id name currentMonth members")
            .lean();

        if (!groups.length) {
            return res.status(200).json({
                success: true,
                data: { pendingCollection: [], pendingPayout: [] }
            });
        }

        const groupIds = groups.map(g => g._id);
        const groupMap = new Map(groups.map(g => [g._id.toString(), g]));

        // ── Fetch payment-phase rounds for current month ───────────────────────
        const rounds = await BiddingRound.find({
            groupId: { $in: groupIds },
            status: { $in: ["PAYMENT_OPEN", "ADMIN_ROUND"] }
        })
            .select("_id groupId monthNumber status payablePerMember winnerUserId winnerReceivableAmount")
            .lean();

        const activeRounds = rounds.filter(r => {
            const group = groupMap.get(r.groupId.toString());
            return group && r.monthNumber === group.currentMonth;
        });

        if (!activeRounds.length) {
            return res.status(200).json({
                success: true,
                data: { pendingCollection: [], pendingPayout: [] }
            });
        }

        const roundIds = activeRounds.map(r => r._id);
        const roundMap = new Map(activeRounds.map(r => [r.groupId.toString(), r]));

        // ── Aggregate COMPLETED transactions per member per round ──────────────
        const completedAgg = await Transaction.aggregate([
            {
                $match: {
                    biddingRoundId: { $in: roundIds.map(id => new mongoose.Types.ObjectId(id)) },
                    status: "COMPLETED"
                }
            },
            {
                $group: {
                    _id: { biddingRoundId: "$biddingRoundId", userId: "$userId", type: "$type" },
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        // Build lookup: "roundId_userId_TYPE" -> totalPaid
        const completedMap = new Map();
        completedAgg.forEach(item => {
            const key = `${item._id.biddingRoundId}_${item._id.userId}_${item._id.type}`;
            completedMap.set(key, item.totalPaid);
        });

        // ── Fetch PENDING transactions (initiated by employee, awaiting member) -
        const pendingTxns = await Transaction.find({
            biddingRoundId: { $in: roundIds },
            status: "PENDING"
        })
            .select("_id userId biddingRoundId type amount paymentMode createdAt")
            .lean();

        // Group PENDING transactions by "roundId_userId_type"
        const pendingTxMap = new Map();
        pendingTxns.forEach(tx => {
            const key = `${tx.biddingRoundId}_${tx.userId}_${tx.type}`;
            if (!pendingTxMap.has(key)) pendingTxMap.set(key, []);
            pendingTxMap.get(key).push({
                transactionId: tx._id,
                amount: tx.amount,
                paymentMode: tx.paymentMode,
                initiatedAt: tx.createdAt
            });
        });

        // ── Build pending collection and payout lists ─────────────────────────
        const pendingCollection = [];
        const pendingPayout = [];

        activeRounds.forEach(round => {
            const group = groupMap.get(round.groupId.toString());
            if (!group) return;

            const winnerIdStr = round.winnerUserId?.toString();

            group.members.forEach(member => {
                const memberIdStr = member.userId?._id?.toString();
                if (!memberIdStr) return;

                const memberName = member.userId?.name || "Unknown";
                const memberPhone = member.userId?.phoneNumber || null;

                // Apply search filter
                if (search && search.trim()) {
                    const term = search.trim().toLowerCase();
                    const matchesName = memberName.toLowerCase().includes(term);
                    const matchesPhone = memberPhone && memberPhone.includes(term);
                    if (!matchesName && !matchesPhone) return;
                }

                // ── Contribution pending ──────────────────────────────────────
                if (memberIdStr !== winnerIdStr) {
                    const completedKey = `${round._id}_${memberIdStr}_CONTRIBUTION`;
                    const pendingKey = `${round._id}_${memberIdStr}_CONTRIBUTION`;

                    const completedPaid = completedMap.get(completedKey) || 0;
                    const pendingTxList = pendingTxMap.get(pendingKey) || [];
                    const pendingTxTotal = pendingTxList.reduce((s, t) => s + t.amount, 0);
                    const remainingAmount = Math.max(0, round.payablePerMember - completedPaid - pendingTxTotal);

                    // Include if there is something outstanding or awaiting confirmation
                    if (remainingAmount > 0 || pendingTxList.length > 0) {
                        pendingCollection.push({
                            memberId: member.userId._id,
                            memberName,
                            memberPhone,
                            groupId: group._id,
                            groupName: group.name,
                            currentMonth: round.monthNumber,
                            payableAmount: round.payablePerMember,
                            completedPaid,
                            remainingAmount,   // not yet initiated — employee still needs to log
                            pendingConfirmations: pendingTxList  // initiated, awaiting member tap
                        });
                    }
                }

                // ── Payout pending ────────────────────────────────────────────
                if (memberIdStr === winnerIdStr) {
                    const completedKey = `${round._id}_${memberIdStr}_WINNER_PAYOUT`;
                    const pendingKey = `${round._id}_${memberIdStr}_WINNER_PAYOUT`;

                    const completedReceived = completedMap.get(completedKey) || 0;
                    const pendingTxList = pendingTxMap.get(pendingKey) || [];
                    const pendingTxTotal = pendingTxList.reduce((s, t) => s + t.amount, 0);
                    const remainingAmount = Math.max(0, round.winnerReceivableAmount - completedReceived - pendingTxTotal);

                    if (remainingAmount > 0 || pendingTxList.length > 0) {
                        pendingPayout.push({
                            memberId: member.userId._id,
                            memberName,
                            memberPhone,
                            groupId: group._id,
                            groupName: group.name,
                            currentMonth: round.monthNumber,
                            receivableAmount: round.winnerReceivableAmount,
                            completedReceived,
                            remainingAmount,
                            pendingConfirmations: pendingTxList
                        });
                    }
                }
            });
        });

        // Sort both lists — most remaining amount first
        pendingCollection.sort((a, b) => b.remainingAmount - a.remainingAmount);
        pendingPayout.sort((a, b) => b.remainingAmount - a.remainingAmount);

        return res.status(200).json({
            success: true,
            data: {
                pendingCollection,
                pendingPayout,
                summary: {
                    totalPendingCollectionMembers: pendingCollection.length,
                    totalPendingPayoutMembers: pendingPayout.length
                }
            }
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


// Controller to get unread notification count
exports.getUnreadNotificationCount = async (req, res, next) => {
    try {
        const employeeId = req.employee._id;

        const count = await Notification.countDocuments({
            recipientId: employeeId,
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
        const employeeId = req.employee._id;

        const unreadOnly = req.query.unreadOnly === "true";
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const skip = unreadOnly ? 0 : (page - 1) * limit;

        const filter = {
            recipientId: employeeId,
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



// ── Employee: POST /employee/push-subscription ────────────────────────────────
exports.saveEmployeePushSubscription = async (req, res, next) => {
    try {
        const { subscription } = req.body;
        const employeeId = req.employee._id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                success: false,
                message: "Valid push subscription object is required"
            });
        }

        await Employee.findByIdAndUpdate(employeeId, {
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