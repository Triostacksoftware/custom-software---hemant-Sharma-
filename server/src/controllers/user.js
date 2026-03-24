const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/user.js");
const BiddingRound = require("../models/biddingRound.js");
const Bid = require("../models/bid.js");
const Groups = require("../models/group.js");
const Transaction = require("../models/transaction.js");
const Employee = require("../models/employee.js");
const Notification = require("../models/notification.js");
const Ad = require("../models/ads.js");

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;


//controller function to register a new user
exports.userSignup = async (req, res, next) => {

    try {
        const { name, phoneNumber, password } = req.body;

        //form data validation
        if (!name || !phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if user already exists
        if (await User.exists({ phoneNumber })) {
            return res.status(409).json({ error: "User already exists" });
        }

        //hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        //create user
        await User.create({
            name,
            phoneNumber,
            password: hashedPassword,
            approvalStatus: "PENDING"
        });

        res.status(201).json({ message: "User creation successful. Awaiting admin approval", success: true });

    } catch (error) {
        next(error);
    }
}


//create login token using jwt
function generateAccessToken(id, name) {
    return jwt.sign(
        { userId: id, name: name },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
    );
}

//controller function for user login
exports.userLogin = async (req, res, next) => {
    try {
        const { phoneNumber, password } = req.body;

        //form data validation
        if (!phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if the user exists or not
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(409).json({ error: "User does not exist" });
        }

        if (user.approvalStatus !== "APPROVED") {
            return res.status(403).json({ error: "Awaiting admin approval" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);  //compare the password
        if (!passwordMatch) {
            return res.status(400).json({ error: "Incorrect password" });
        }

        return res.status(200).json({
            message: "Login successful",
            success: true,
            token: generateAccessToken(user._id, user.name)
        });


    } catch (error) {
        next(error);

    }
};


//controller to place bid
exports.placeBid = async (req, res, next) => {
    try {
        const { biddingRoundId, bidAmount } = req.body;
        const userId = req.user._id;

        if (!biddingRoundId || bidAmount === undefined) {
            return res.status(400).json({
                success: false,
                message: "Bidding round ID and bid amount are required"
            });
        }

        // Fetch bidding round
        const round = await BiddingRound.findById(biddingRoundId);

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        // Ensure round is OPEN
        if (round.status !== "OPEN") {
            return res.status(400).json({
                success: false,
                message: "Bidding is not open"
            });
        }

        const now = new Date();

        //Auto close if expired
        if (now > round.endedAt) {

            // Close round
            round.status = "CLOSED";
            await round.save();

            const io = req.app.get("io");
            io.to(biddingRoundId.toString()).emit("biddingClosed", {
                message: "Bidding time expired"
            });

            return res.status(400).json({
                success: false,
                message: "Bidding time has expired"
            });
        }

        //user cannot bid if already won in this group
        const previousWin = await BiddingRound.findOne({
            groupId: round.groupId,
            winnerUserId: userId
        });

        if (previousWin) {
            return res.status(403).json({
                success: false,
                message: "You have already won in this group and cannot bid again"
            });
        }

        // Validate bid range (10% - 20%)
        const minBid = round.totalPoolAmount * 0.10;
        const maxBid = round.totalPoolAmount * 0.20;

        if (bidAmount < minBid || bidAmount > maxBid) {
            return res.status(400).json({
                success: false,
                message: `Bid must be between ${minBid} and ${maxBid}`
            });
        }

        // Check if user already placed a bid
        const existingBid = await Bid.findOne({
            biddingRoundId,
            userId
        });

        if (existingBid && bidAmount <= existingBid.bidAmount) {
            return res.status(400).json({
                success: false,
                message: "New bid must be higher than your previous bid"
            });
        }

        // Upsert bid
        const updatedBid = await Bid.findOneAndUpdate(
            { biddingRoundId, userId },
            {
                biddingRoundId,
                groupId: round.groupId,
                monthNumber: round.monthNumber,
                userId,
                bidAmount
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        ).populate("userId", "name");

        // Emit real-time update
        const io = req.app.get("io");

        io.to(biddingRoundId.toString()).emit("newBidPlaced", {
            userId: updatedBid.userId._id,
            name: updatedBid.userId.name,
            bidAmount: updatedBid.bidAmount,
            timestamp: updatedBid.updatedAt
        });

        return res.status(200).json({
            success: true,
            message: "Bid placed successfully",
            data: {
                bidAmount: updatedBid.bidAmount
            }
        });

    } catch (error) {
        next(error);
    }
};


// Controller to confirm transaction (contribution and payout both).
// The employee side (logTransaction) will later mark it COMPLETED.
exports.confirmTransaction = async (req, res, next) => {
    try {

        const {
            groupId,
            biddingRoundId,
            monthNumber,
            amount,
            type,
            paymentMode,   // member specifies how they paid e.g. CASH, UPI
            handledBy      // _id of the employee who collected/delivered
        } = req.body;

        const userId = req.user._id;

        //Basic field validation
        if (!groupId || !monthNumber || !amount || !type || !paymentMode || !handledBy) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(biddingRoundId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid biddingRoundId"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(handledBy)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID"
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

        if (!["CASH", "UPI", "INTERNET_BANKING", "CHEQUE"].includes(paymentMode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment mode"
            });
        }

        //Validate employee exists and is approved
        // Prevent members from selecting a non-existent or unapproved employee
        const employee = await Employee.findOne({
            _id: handledBy,
            approvalStatus: "APPROVED"
        }).lean();

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Selected employee not found or not approved"
            });
        }

        //Fetch and validate group
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
                message: "Group not active"
            });
        }

        const member = group.members.find(
            m => m.userId.toString() === userId.toString()
        );

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "User not member of this group"
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
                message: "Payments not open yet"
            });
        }

        if (
            round.groupId.toString() !== groupId ||
            round.monthNumber !== monthNumber
        ) {
            return res.status(400).json({
                success: false,
                message: "Round does not belong to this group/month"
            });
        }

        // CONTRIBUTION: validate amount does not exceed remaining balance
        if (type === "CONTRIBUTION") {

            if (round.winnerUserId.toString() === userId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "Winner does not pay contribution"
                });
            }

            const previousTransactions = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "CONTRIBUTION",
                status: { $in: ["USER_CONFIRMED", "COMPLETED"] }
            }).select("amount").lean();

            const total = previousTransactions.reduce(
                (sum, t) => sum + t.amount, 0
            );

            if (total + amount > round.payablePerMember) {
                return res.status(400).json({
                    success: false,
                    message: `Contribution exceeds limit. Confirmed so far: ${total}/${round.payablePerMember}`
                });
            }

        }

        //WINNER_PAYOUT: validate amount does not exceed remaining payout
        if (type === "WINNER_PAYOUT") {

            if (round.winnerUserId.toString() !== userId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "Only winner receives payout"
                });
            }

            const previousPayouts = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "WINNER_PAYOUT",
                status: { $in: ["USER_CONFIRMED", "COMPLETED"] }
            }).select("amount").lean();

            const total = previousPayouts.reduce(
                (sum, t) => sum + t.amount, 0
            );

            const winnerReceivable = round.totalPoolAmount - round.winningBidAmount;

            if (total + amount > winnerReceivable) {
                return res.status(400).json({
                    success: false,
                    message: `Payout exceeds receivable amount. Confirmed so far: ${total}/${winnerReceivable}`
                });
            }

        }

        // Create the USER_CONFIRMED transaction with payment details
        // paymentMode and handledBy are saved now so the employee side
        // (logTransaction) only needs to verify and flip status to COMPLETED
        await Transaction.create({
            groupId,
            userId,
            biddingRoundId,
            monthNumber,
            amount,
            type,
            paymentMode,
            handledBy,
            status: "USER_CONFIRMED"
        });

        return res.status(201).json({
            success: true,
            message: "Transaction confirmation recorded"
        });

    } catch (error) {
        next(error);
    }
};


//controller to get user dashboard data
exports.getDashboardStats = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const userObjId = new mongoose.Types.ObjectId(userId);

        // Fetch all active groups this member belongs to
        const groups = await Groups.find({
            "members.userId": userId,
            status: "ACTIVE"
        }).select("_id currentMonth monthlyContribution").lean();

        if (!groups.length) {
            return res.status(200).json({
                success: true,
                data: { pendingAmount: 0, receivableAmount: 0 }
            });
        }

        const groupIds = groups.map(g => g._id);

        // Build a map of groupId -> currentMonth for quick lookup
        const groupMonthMap = new Map(
            groups.map(g => [g._id.toString(), g.currentMonth])
        );

        //Fetch all relevant bidding rounds in one query
        // For pendingAmount: rounds where winnerUserId != userId (member owes contribution)
        // For receivableAmount: rounds where winnerUserId == userId (member is owed payout)
        const allRounds = await BiddingRound.find({
            groupId: { $in: groupIds },
            status: { $nin: ["PENDING"] }
        }).select("groupId monthNumber winnerUserId winnerReceivableAmount payablePerMember isAdminRound").lean();

        //Fetch all COMPLETED transactions for this user in one query
        const completedTransactions = await Transaction.aggregate([
            {
                $match: {
                    userId: userObjId,
                    groupId: { $in: groupIds.map(id => new mongoose.Types.ObjectId(id)) },
                    status: "COMPLETED"
                }
            },
            {
                $group: {
                    _id: "$type",
                    total: { $sum: "$amount" }
                }
            }
        ]);

        // Build totals from aggregation result
        const completedMap = {};
        completedTransactions.forEach(item => {
            completedMap[item._id] = item.total;
        });

        const totalCompletedContributions = completedMap["CONTRIBUTION"] || 0;
        const totalCompletedPayouts = completedMap["WINNER_PAYOUT"] || 0;

        //Calculate gross pending contribution 
        let grossContributionOwed = 0;

        allRounds.forEach(round => {
            const currentMonth = groupMonthMap.get(round.groupId.toString());
            if (!currentMonth) return;

            // Only count rounds up to and including the current month
            if (round.monthNumber > currentMonth) return;

            // Member owes contribution for every round they did NOT win
            const memberWonThisRound =
                round.winnerUserId?.toString() === userId.toString();

            if (!memberWonThisRound) {
                grossContributionOwed += round.payablePerMember || 0;
            }
        });

        // pendingAmount = what they owe minus what they've already fully paid
        const pendingAmount = Math.max(0, grossContributionOwed - totalCompletedContributions);

        //Calculate receivable amount
        let grossReceivable = 0;

        allRounds.forEach(round => {
            const memberWonThisRound =
                round.winnerUserId?.toString() === userId.toString();

            if (memberWonThisRound) {
                grossReceivable += round.winnerReceivableAmount || 0;
            }
        });

        const receivableAmount = Math.max(0, grossReceivable - totalCompletedPayouts);

        return res.status(200).json({
            success: true,
            data: {
                pendingAmount,
                receivableAmount
            }
        });

    } catch (error) {
        next(error);
    }
};

//controller to get unread notification count
exports.getUnreadNotificationCount = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const count = await Notification.countDocuments({
            recipientId: userId,
            recipientModel: "User",
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


//controller to get active ads
exports.getActiveAd = async (req, res, next) => {
    try {
        const ad = await Ad.findOne({ isActive: true })
            .sort({ updatedAt: -1 })
            .lean();

        if (!ad) {
            return res.status(200).json({
                success: true,
                data: null
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                adText: ad.adText,
                adLink: ad.adLink
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to get list of groups
exports.getGroups = async (req, res, next) => {
    try {
        const userId = req.user._id.toString();

        // Single query — fetch all DRAFT and ACTIVE groups.
        // We deliberately exclude COMPLETED groups since they are not joinable
        // and irrelevant to a member who is not already in them.
        const allGroups = await Groups.find({
            status: { $in: ["DRAFT", "ACTIVE"] }
        })
            .select("name monthlyContribution totalMembers status members joinRequests")
            .lean();

        const myGroups = [];
        const availableGroups = [];

        allGroups.forEach(group => {

            const isMember = group.members.some(
                m => m.userId.toString() === userId
            );

            if (isMember) {
                // Member is already in this group — add to myGroups with basic details
                myGroups.push({
                    _id: group._id,
                    name: group.name,
                    monthlyContribution: group.monthlyContribution,
                    totalMembers: group.totalMembers,
                    currentMemberCount: group.members.length,
                    status: group.status
                });
            } else {
                // Member is not in this group — check if they have a pending join request
                const joinRequest = group.joinRequests?.find(
                    r => r.userId.toString() === userId
                );

                // Only show PENDING request status to the member.
                // APPROVED means they'd already be a member (handled above).
                // REJECTED means they can request again.
                const hasRequestedToJoin =
                    joinRequest?.status === "PENDING";

                const isFull = group.members.length >= group.totalMembers;

                availableGroups.push({
                    _id: group._id,
                    name: group.name,
                    monthlyContribution: group.monthlyContribution,
                    totalMembers: group.totalMembers,
                    currentMemberCount: group.members.length,
                    status: group.status,
                    isFull,
                    hasRequestedToJoin
                });
            }
        });

        return res.status(200).json({
            success: true,
            data: { myGroups, availableGroups }
        });

    } catch (error) {
        next(error);
    }
};


//controller to request to join a group
exports.requestToJoinGroup = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { groupId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID"
            });
        }

        const group = await Groups.findById(groupId)
            .select("name status totalMembers members joinRequests")
            .lean();

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        // COMPLETED groups cannot be joined
        if (group.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "This group has already completed and is not accepting requests"
            });
        }

        // Already a member
        const alreadyMember = group.members.some(
            m => m.userId.toString() === userId.toString()
        );
        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                message: "You are already a member of this group"
            });
        }

        // Already has a pending request — prevent duplicate requests
        const existingRequest = group.joinRequests?.find(
            r => r.userId.toString() === userId.toString() && r.status === "PENDING"
        );
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "You have already sent a join request for this group. Please wait for admin approval"
            });
        }

        // Group is full — block the request regardless of DRAFT or ACTIVE status.
        // For ACTIVE groups the message is more specific since they cannot be
        // added even if admin wanted to.
        const isFull = group.members.length >= group.totalMembers;
        if (isFull) {
            // TODO: send notification to admin that this user showed interest
            // even though the group is full — to be implemented in notifications phase

            const message = group.status === "ACTIVE"
                ? "This group is full and no longer accepting new members. Please contact the admin directly"
                : "This group is currently full. Please contact the admin";

            return res.status(400).json({
                success: false,
                message
            });
        }

        // All validations passed — push join request into the group's joinRequests array
        await Groups.findByIdAndUpdate(groupId, {
            $push: {
                joinRequests: {
                    userId,
                    status: "PENDING",
                    requestedAt: new Date()
                }
            }
        });

        // TODO: send GROUP_JOIN_REQUEST notification to admin
        // to be implemented in the notifications phase

        return res.status(200).json({
            success: true,
            message: "Join request sent successfully"
        });

    } catch (error) {
        next(error);
    }
};


//controller to get notifications
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const unreadOnly = req.query.unreadOnly === "true";
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const skip = unreadOnly ? 0 : (page - 1) * limit;

        // Base filter — always scoped to this member only
        const filter = {
            recipientId: userId,
            recipientModel: "User"
        };

        if (unreadOnly) {
            filter.isRead = false;
        }

        // Run count and fetch in parallel for efficiency.
        // Count is used by the View All page to render pagination controls.
        // For the modal (unreadOnly=true) the count is still useful —
        // frontend can use it to show "5 of 12 unread" if needed.
        const [notifications, totalCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("title body type groupId isRead status scheduledAt createdAt")
                .lean(),
            Notification.countDocuments(filter)
        ]);

        // Mark fetched unread notifications as read automatically
        // when the modal opens (unreadOnly=true).
        // For the View All page we do NOT auto-mark as read —
        // user may just be browsing, and we want the badge count
        // to remain accurate until they explicitly view the modal.
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


//controller to get detailed info of a member inside a group
exports.getGroupDetails = async (req, res, next) => {
    try {

        const userId = req.user._id;
        const { groupId } = req.params;

        //fetch group
        const group = await Groups.findById(groupId).lean();

        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        //Verify user is a member of this group
        const member = group.members?.find(
            m => m.userId.toString() === userId.toString()
        );

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "User is not part of this group"
            });
        }

        //Fetch all bidding rounds and user's transactions in parallel
        const [rounds, transactions] = await Promise.all([
            BiddingRound.find({ groupId }).lean(),
            Transaction.find({ groupId, userId }).sort({ createdAt: -1 }).lean()
        ]);

        //Identify the current active round for this group 
        const currentRound = rounds.find(
            r => r.monthNumber === group.currentMonth
        );

        //Check if this user has ever won in this group
        const winningRound = rounds.find(
            r => r.winnerUserId?.toString() === userId.toString()
        );

        //Build memberInfo with pending amounts
        const memberInfo = {
            hasWon: !!winningRound,
            winningMonth: winningRound ? winningRound.monthNumber : null,
            winningAmount: winningRound ? winningRound.winnerReceivableAmount : 0,
            pendingContribution: 0,
            pendingPayout: 0
        };

        //Format transactions and accumulate pending amounts
        const formattedTransactions = transactions.map(tx => {

            // Accumulate pending amounts for the member info panel
            if (tx.status !== "COMPLETED") {
                if (tx.type === "CONTRIBUTION") {
                    memberInfo.pendingContribution += tx.amount;
                }
                if (tx.type === "WINNER_PAYOUT") {
                    memberInfo.pendingPayout += tx.amount;
                }
            }

            return {
                _id: tx._id,
                type: tx.type,
                monthNumber: tx.monthNumber,
                amount: tx.amount,
                status: tx.status,
                createdAt: tx.createdAt
            };

        });

        //Build current bidding round data and fetch live bids
        let currentBiddingRound = null;
        let bids = [];

        if (currentRound) {

            // Shape the round data for the frontend
            currentBiddingRound = {
                _id: currentRound._id,
                status: currentRound.status,
                monthNumber: currentRound.monthNumber,
                totalPoolAmount: currentRound.totalPoolAmount,
                minBid: currentRound.totalPoolAmount * 0.10,
                maxBid: currentRound.totalPoolAmount * 0.20,
                startedAt: currentRound.startedAt,
                endedAt: currentRound.endedAt,
                winningBidAmount: currentRound.winningBidAmount || null,
                winnerUserId: currentRound.winnerUserId || null,
                payablePerMember: currentRound.payablePerMember,
                winnerReceivableAmount: currentRound.winnerReceivableAmount || null,
                dividendPerMember: currentRound.dividendPerMember || null
            };

            //fetch bids placed by the members
            const existingBids = await Bid.find({ biddingRoundId: currentRound._id })
                .populate("userId", "name")
                .sort({ updatedAt: 1 })  // chronological order, oldest bid first
                .lean();

            bids = existingBids.map(bid => ({
                userId: bid.userId._id,
                name: bid.userId.name || "Unknown",
                bidAmount: bid.bidAmount,
                timestamp: bid.updatedAt   // updatedAt reflects the latest bid upsert time
            }));

        }

        //Build bidding history from the Bid collection
        const pastRounds = rounds.filter(r => r.monthNumber < group.currentMonth);
        const pastRoundIds = pastRounds.map(r => r._id);

        // Fetch this user's bids for all past rounds in a single query
        const pastUserBids = await Bid.find({
            biddingRoundId: { $in: pastRoundIds },
            userId
        }).lean();

        // Map: biddingRoundId (string) → bidAmount
        const userBidMap = new Map(
            pastUserBids.map(b => [b.biddingRoundId.toString(), b.bidAmount])
        );

        const biddingHistory = pastRounds.map(round => ({
            monthNumber: round.monthNumber,
            userBid: userBidMap.get(round._id.toString()) ?? null,
            winningBid: round.winningBidAmount || null,
            winnerUserId: round.winnerUserId || null
        }));

        //Return the full response
        return res.status(200).json({
            success: true,
            data: {
                group: {
                    _id: group._id,
                    name: group.name,
                    totalMembers: group.members?.length || 0,
                    totalMonths: group.totalMonths,
                    monthlyContribution: group.monthlyContribution,
                    currentMonth: group.currentMonth,
                    status: group.status,
                    startDate: group.startDate
                },
                memberInfo,
                currentBiddingRound,
                bids,
                transactions: formattedTransactions,
                biddingHistory
            }
        });

    } catch (error) {
        next(error);
    }
};


//controller to fetch approved employees (for member side employee selection dropdown)
exports.getEmployeesForMember = async (req, res, next) => {
    try {
        // Only return employees who have been approved
        const employees = await Employee.find({ approvalStatus: "APPROVED", role: "EMPLOYEE" })
            .select("_id name phoneNumber")   // minimum fields needed for the dropdown
            .sort({ name: 1 })               // alphabetical for easy scanning
            .lean();

        return res.status(200).json({
            success: true,
            message: "Employees fetched successfully",
            data: { employees }
        });

    } catch (error) {
        next(error);
    }
};


//controller to get the overall transaction history
exports.getTransactionHistory = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const skip = (page - 1) * limit;

        // Base filter — always scoped to this member only
        const filter = { userId };

        // Optional filters — only applied if query param is present and valid
        const VALID_TYPES = ["CONTRIBUTION", "WINNER_PAYOUT"];
        const VALID_STATUSES = ["USER_CONFIRMED", "COMPLETED", "CANCELLED"];

        if (req.query.type && VALID_TYPES.includes(req.query.type)) {
            filter.type = req.query.type;
        }
        if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
            filter.status = req.query.status;
        }
        if (req.query.groupId) {
            filter.groupId = req.query.groupId;
        }

        // Run count and fetch in parallel
        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("groupId", "name")
                .populate("handledBy", "name")
                .select("amount type status monthNumber createdAt groupId handledBy")
                .lean(),
            Transaction.countDocuments(filter)
        ]);

        // Reshape populated fields to match the expected response format:
        // groupId -> group, handledBy stays as handledBy
        const formatted = transactions.map(tx => ({
            _id: tx._id,
            amount: tx.amount,
            type: tx.type,
            status: tx.status,
            monthNumber: tx.monthNumber,
            createdAt: tx.createdAt,
            group: tx.groupId ? {
                _id: tx.groupId._id,
                name: tx.groupId.name
            } : null,
            handledBy: tx.handledBy ? {
                _id: tx.handledBy._id,
                name: tx.handledBy.name
            } : null
        }));

        return res.status(200).json({
            success: true,
            data: {
                transactions: formatted,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: page * limit < total
                }
            }
        });

    } catch (error) {
        next(error);
    }
};