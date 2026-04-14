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

const {
    notifyMember,
    notifyEmployee,
    notifyGroupMembers,
    notifyAdmins,
    notifyAllEmployees
} = require("../services/notificationService.js");

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

//controller to get bidding page dashboard
exports.getBiddingDashboard = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Fetch all active groups this member belongs to
        const groups = await Groups.find({
            "members.userId": userId,
            status: "ACTIVE"
        }).select("_id name currentMonth").lean();

        if (!groups.length) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Build a map of groupId -> groupName for quick lookup
        const groupMap = new Map(
            groups.map(g => [g._id.toString(), g.name])
        );

        const groupIds = groups.map(g => g._id);
        const currentMonths = new Map(groups.map(g => [g._id.toString(), g.currentMonth]));

        // Fetch current month's BiddingRound for each group in one query.
        const rounds = await BiddingRound.find({
            groupId: { $in: groupIds },
            status: { $nin: ["FINALIZED", "ADMIN_ROUND", "COLLECTION_DONE"] }
        })
            .select("groupId monthNumber status scheduledBiddingDate startedAt endedAt minBid maxBid bidMultiple winnerUserId winningBidAmount dividendPerMember payablePerMember")
            .lean();

        // Filter to only current month's round per group
        const currentRounds = rounds.filter(round => {
            const currentMonth = currentMonths.get(round.groupId.toString());
            return round.monthNumber === currentMonth;
        });

        const data = currentRounds.map(round => ({
            groupId: round.groupId,
            groupName: groupMap.get(round.groupId.toString()) || "Unknown Group",
            biddingRoundId: round._id,
            status: round.status,
            scheduledBiddingDate: round.scheduledBiddingDate || null,
            endedAt: round.endedAt || null,
            monthNumber: round.monthNumber,

            // Added for the Dashboard UI
            winnerUserId: round.winnerUserId || null,
            dividendPerMember: round.dividendPerMember || 0,
            payablePerMember: round.payablePerMember || 0
        }));

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        next(error);
    }
};

//controller to get bidding room data
exports.getBiddingRoom = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { roundId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(roundId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid round ID"
            });
        }

        // Fetch round with group name populated
        const round = await BiddingRound.findById(roundId)
            .populate("groupId", "name members")
            .lean();

        if (!round) {
            return res.status(404).json({
                success: false,
                message: "Bidding round not found"
            });
        }

        // Verify this member belongs to the group — prevent accessing
        // other groups' bidding rooms
        const isMember = round.groupId?.members?.some(
            m => m.userId.toString() === userId.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this group"
            });
        }

        // // Only OPEN rounds have a live room to enter
        // if (round.status !== "OPEN") {
        //     return res.status(400).json({
        //         success: false,
        //         message: `Bidding room is not available. Current status: ${round.status}`
        //     });
        // }

        // Allow entry for OPEN, CLOSED, PAYMENT_OPEN, and FINALIZED. 
        // (Block UPCOMING or DRAFT if you have them)
        const allowedStatuses = ["OPEN", "CLOSED", "PAYMENT_OPEN"];
        if (!allowedStatuses.includes(round.status)) {
            return res.status(400).json({
                success: false,
                message: `Bidding room is not available. Current status: ${round.status}`
            });
        }

        // Fetch all bids for this round sorted chronologically
        const bids = await Bid.find({ biddingRoundId: roundId })
            .sort({ updatedAt: 1 })
            .select("userId bidAmount updatedAt")
            .lean();

        // Shape bids — include userId so frontend can identify own bid,
        // but do not include member names (keeps bidding anonymous)
        const formattedBids = bids.map(bid => ({
            userId: bid.userId,
            bidAmount: bid.bidAmount,
            timestamp: bid.updatedAt
        }));

        return res.status(200).json({
            success: true,
            data: {
                round: {
                    _id: round._id,
                    groupName: round.groupId?.name || "Unknown Group",
                    status: round.status,
                    minBid: round.minBid,
                    maxBid: round.maxBid,
                    bidMultiple: round.bidMultiple,
                    endedAt: round.endedAt,
                    monthNumber: round.monthNumber,

                    // Added Financial Results for the UI to display if closed
                    winnerUserId: round.winnerUserId || null,
                    winningBidAmount: round.winningBidAmount || 0,
                    dividendPerMember: round.dividendPerMember || 0,
                    payablePerMember: round.payablePerMember || 0,
                    winnerReceivableAmount: round.winnerReceivableAmount || 0
                },
                bids: formattedBids
            }
        });

    } catch (error) {
        next(error);
    }
};

// Controller to place bid
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

        // Auto close if expired
        if (now > round.endedAt) {
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

        // User cannot bid if already won in this group
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

        // Resolve bid constraints
        // Fall back to 10%/20% for safety
        const minBid = round.minBid > 0 ? round.minBid : round.totalPoolAmount * 0.10;
        const maxBid = round.maxBid > 0 ? round.maxBid : round.totalPoolAmount * 0.20;
        const bidMultiple = round.bidMultiple > 0 ? round.bidMultiple : 1;

        //Rule 1: Bid must be within min/max range
        if (bidAmount < minBid || bidAmount > maxBid) {
            return res.status(400).json({
                success: false,
                message: `Bid must be between ₹${minBid} and ₹${maxBid}`
            });
        }

        // Rule 2: Bid must be an exact multiple of bidMultiple
        if (bidAmount % bidMultiple !== 0) {
            return res.status(400).json({
                success: false,
                message: `Bid must be a multiple of ₹${bidMultiple} (e.g. ₹${bidMultiple}, ₹${bidMultiple * 2}, ₹${bidMultiple * 3}...)`
            });
        }

        // Rule 3: Member's new bid must exceed their own previous bid
        const existingBid = await Bid.findOne({ biddingRoundId, userId });

        if (existingBid && bidAmount <= existingBid.bidAmount) {
            return res.status(400).json({
                success: false,
                message: `Your new bid must be higher than your previous bid of ₹${existingBid.bidAmount}`
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

        // Emit real-time update to all clients in the bidding room
        const io = req.app.get("io");
        io.to(biddingRoundId.toString()).emit("newBidPlaced", {
            userId: updatedBid.userId._id,
            // name: updatedBid.userId.name,
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
exports.confirmTransaction = async (req, res, next) => {
    try {
        const { transactionId } = req.body;
        const userId = req.user._id;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "transactionId is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid transactionId"
            });
        }

        const transaction = await Transaction.findById(transactionId);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        if (transaction.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "This transaction does not belong to you"
            });
        }

        if (transaction.status !== "PENDING") {
            return res.status(400).json({
                success: false,
                message: `Transaction cannot be confirmed. Current status: ${transaction.status}`
            });
        }

        const round = await BiddingRound.findById(transaction.biddingRoundId);

        if (!round || !["PAYMENT_OPEN", "ADMIN_ROUND"].includes(round.status)) {
            return res.status(400).json({
                success: false,
                message: "Payment phase is no longer active for this round"
            });
        }

        // Fetch group name for notification messages
        const group = await Groups.findById(transaction.groupId)
            .select("name")
            .lean();

        // Mark transaction as COMPLETED
        transaction.status = "COMPLETED";
        await transaction.save();

        const io = req.app.get("io");

        // ── Notify the employee who initiated the transaction ─────────────────
        //
        // Employee gets confirmation that the member has acknowledged the payment.
        // This closes the loop for the employee without them needing to follow up.
        const transactionLabel = transaction.type === "CONTRIBUTION"
            ? `contribution of ₹${transaction.amount}`
            : `payout of ₹${transaction.amount}`;

        notifyEmployee(
            transaction.handledBy,
            "Member Confirmed Payment ✅",
            `Member has confirmed the ${transactionLabel} for "${group?.name}" Month ${transaction.monthNumber}.`,
            "PAYMENT_CONFIRMED",
            io,
            transaction.groupId
        );

        // Also emit a dedicated socket event to the employee's personal room
        // so they see the confirmation instantly without refreshing
        io.to(`employee_${transaction.handledBy}`).emit("transactionConfirmed", {
            transactionId: transaction._id,
            amount: transaction.amount,
            type: transaction.type,
            groupName: group?.name,
            monthNumber: transaction.monthNumber
        });

        // ── Auto-finalize check — ADMIN_ROUND (month 1) only ─────────────────
        let autoFinalized = false;

        if (round.status === "ADMIN_ROUND") {
            autoFinalized = await checkAndAutoFinalizeAdminRound(round, io);
        }

        return res.status(200).json({
            success: true,
            message: autoFinalized
                ? "Transaction confirmed. All payments complete — group moved to next month!"
                : "Transaction confirmed successfully",
            data: {
                transactionId: transaction._id,
                amount: transaction.amount,
                type: transaction.type,
                status: "COMPLETED",
                autoFinalized
            }
        });

    } catch (error) {
        next(error);
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// Helper: checkAndAutoFinalizeAdminRound
// io is now passed in so notifications can fire on auto-finalize
// ─────────────────────────────────────────────────────────────────────────────
async function checkAndAutoFinalizeAdminRound(round, io) {
    try {
        const group = await Groups.findById(round.groupId).lean();
        if (!group) return false;

        const activeMembers = group.members.filter(m => m.status === "ACTIVE");
        const requiredPerMember = round.payablePerMember;

        const completedAgg = await Transaction.aggregate([
            {
                $match: {
                    biddingRoundId: new mongoose.Types.ObjectId(round._id),
                    type: "CONTRIBUTION",
                    status: "COMPLETED"
                }
            },
            {
                $group: {
                    _id: "$userId",
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        const paidMap = new Map(
            completedAgg.map(e => [e._id.toString(), e.totalPaid])
        );

        const allPaid = activeMembers.every(member => {
            const totalPaid = paidMap.get(member.userId.toString()) || 0;
            return totalPaid >= requiredPerMember;
        });

        if (!allPaid) return false;

        // All paid — finalize
        const now = new Date();

        await BiddingRound.findByIdAndUpdate(round._id, {
            $set: { status: "FINALIZED", finalizedAt: now }
        });

        const groupDoc = await Groups.findById(round.groupId);
        groupDoc.currentMonth += 1;
        groupDoc.members.forEach(m => { m.currentPaymentStatus = "PENDING"; });

        if (groupDoc.currentMonth > groupDoc.totalMonths) {
            groupDoc.status = "COMPLETED";
            await groupDoc.save();

            // Notify all members — group cycle is complete
            notifyGroupMembers(
                group._id,
                "Chit Group Completed 🎊",
                `"${group.name}" has completed its full cycle. Thank you for participating!`,
                "GROUP_FINALIZED",
                io
            );

            return true;
        }

        await groupDoc.save();

        // Create month 2 BiddingRound
        const scheduledBiddingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const totalPoolAmount = groupDoc.totalMembers * groupDoc.monthlyContribution;

        await BiddingRound.create({
            groupId: groupDoc._id,
            monthNumber: groupDoc.currentMonth,
            status: "PENDING",
            totalPoolAmount,
            isAdminRound: false,
            scheduledBiddingDate,
            minBid: 0,
            maxBid: 0,
            bidMultiple: 1
        });

        // ── Notify all members — month 1 complete, bidding coming in 30 days ──
        const biddingDate = scheduledBiddingDate.toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric"
        });

        notifyGroupMembers(
            group._id,
            "Month 1 Complete! Bidding Coming Soon 🗓️",
            `All contributions received for "${group.name}". Bidding for Month 2 is scheduled around ${biddingDate}.`,
            "GROUP_FINALIZED",
            io
        );

        // ── Notify admin — month 1 is done, next bidding needs to be set up ───
        notifyAdmins(
            "Month 1 Complete — Set Up Bidding",
            `All Month 1 contributions collected for "${group.name}". Bidding for Month 2 is scheduled around ${biddingDate}. Please set bid limits when ready.`,
            "GROUP_FINALIZED",
            io,
            group._id
        );

        return true;

    } catch (err) {
        console.error("Auto-finalize error:", err);
        return false;
    }
}

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

        if (group.status === "COMPLETED") {
            return res.status(400).json({
                success: false,
                message: "This group has already completed and is not accepting requests"
            });
        }

        const alreadyMember = group.members.some(
            m => m.userId.toString() === userId.toString()
        );
        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                message: "You are already a member of this group"
            });
        }

        const existingRequest = group.joinRequests?.find(
            r => r.userId.toString() === userId.toString() && r.status === "PENDING"
        );
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "You have already sent a join request for this group. Please wait for admin approval"
            });
        }

        const isFull = group.members.length >= group.totalMembers - 1;
        if (isFull) {
            // Group is full — still notify admin that someone showed interest
            const io = req.app.get("io");
            const user = req.user;

            notifyAdmins(
                "Member Interest — Group Full",
                `${user.name} (${user.phoneNumber}) wants to join "${group.name}" but it is full. Consider creating a new group.`,
                "GROUP_JOIN_REQUEST",
                io,
                group._id
            );

            const message = group.status === "ACTIVE"
                ? "This group is full and no longer accepting new members. Please contact the admin directly"
                : "This group is currently full. Please contact the admin";

            return res.status(400).json({
                success: false,
                message
            });
        }

        // Save join request
        await Groups.findByIdAndUpdate(groupId, {
            $push: {
                joinRequests: {
                    userId,
                    status: "PENDING",
                    requestedAt: new Date()
                }
            }
        });

        // ── Notify admin — a member wants to join this group ──────────────────
        //
        // Admin needs to approve or reject the request from their panel.
        // The notification includes member name and phone so admin can
        // identify them without opening the approvals page.
        const io = req.app.get("io");
        const user = req.user;

        notifyAdmins(
            "New Group Join Request 👤",
            `${user.name} (${user.phoneNumber}) has requested to join "${group.name}".`,
            "GROUP_JOIN_REQUEST",
            io,
            group._id
        );

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
        const VALID_STATUSES = ["PENDING", "COMPLETED", "CANCELLED"];

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


//controller to get pending dues (raise request page)
exports.getPendingDues = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const userObjId = new mongoose.Types.ObjectId(userId);

        // Fetch all active groups this member belongs to
        const groups = await Groups.find({
            "members.userId": userId,
            status: "ACTIVE"
        }).select("_id name currentMonth").lean();

        if (!groups.length) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const groupIds = groups.map(g => g._id);

        // Build groupId -> group map for quick lookup
        const groupMap = new Map(
            groups.map(g => [g._id.toString(), g])
        );

        //Fetch current month's BiddingRound for each group
        const rounds = await BiddingRound.find({
            groupId: { $in: groupIds },
            status: { $in: ["PAYMENT_OPEN", "ADMIN_ROUND"] }
        }).select("groupId monthNumber status payablePerMember winnerReceivableAmount winnerUserId isAdminRound").lean();

        if (!rounds.length) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Build a map of groupId -> round for quick lookup
        const roundMap = new Map(
            rounds.map(r => [r.groupId.toString(), r])
        );

        const roundIds = rounds.map(r => r._id);

        //Fetch all COMPLETED transactions for this user in these rounds
        const completedTxAgg = await Transaction.aggregate([
            {
                $match: {
                    userId: userObjId,
                    biddingRoundId: { $in: roundIds.map(id => new mongoose.Types.ObjectId(id)) },
                    status: "COMPLETED"
                }
            },
            {
                $group: {
                    _id: {
                        biddingRoundId: "$biddingRoundId",
                        type: "$type"
                    },
                    totalPaid: { $sum: "$amount" }
                }
            }
        ]);

        // Build map: "roundId_TYPE" -> totalPaid
        const paidMap = new Map();
        completedTxAgg.forEach(item => {
            const key = `${item._id.biddingRoundId.toString()}_${item._id.type}`;
            paidMap.set(key, item.totalPaid);
        });

        //Build response
        const data = [];

        groups.forEach(group => {
            const round = roundMap.get(group._id.toString());

            // No active payment round for this group — skip
            if (!round) return;

            // How much this member has already paid this month
            const paidContribution = paidMap.get(`${round._id.toString()}_CONTRIBUTION`) || 0;
            const paidPayout = paidMap.get(`${round._id.toString()}_WINNER_PAYOUT`) || 0;

            // Pending contribution — every non-winner member owes payablePerMember.
            // For ADMIN_ROUND (month 1): winnerUserId is null (admin won),
            // so member always owes payablePerMember.
            const isCurrentRoundWinner =
                round.winnerUserId?.toString() === userId.toString();

            const pendingContribution = isCurrentRoundWinner
                ? 0
                : Math.max(0, (round.payablePerMember || 0) - paidContribution);

            // Pending payout — only non-zero if this member won this round
            const pendingPayout = isCurrentRoundWinner
                ? Math.max(0, (round.winnerReceivableAmount || 0) - paidPayout)
                : 0;

            // Only include groups where something is still pending
            if (pendingContribution === 0 && pendingPayout === 0) return;

            data.push({
                groupId: group._id,
                groupName: group.name,
                pendingContribution,
                pendingPayout
            });
        });

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        next(error);
    }
};


// ── Member: POST /user/push-subscription ─────────────────────────────────────
exports.savePushSubscription = async (req, res, next) => {
    try {
        const { subscription } = req.body;
        const userId = req.user._id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({
                success: false,
                message: "Valid push subscription object is required"
            });
        }

        await User.findByIdAndUpdate(userId, {
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


// POST /user/requests/raise
//controller to raise a payment request
exports.raisePaymentRequest = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { groupId, type } = req.body;

        // ── Validation ────────────────────────────────────────────────────────
        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "groupId is required"
            });
        }

        if (!["CONTRIBUTION", "WINNER_PAYOUT"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "type must be CONTRIBUTION or WINNER_PAYOUT"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid group ID"
            });
        }

        // ── Fetch and validate group ──────────────────────────────────────────
        const group = await Groups.findById(groupId)
            .select("name status currentMonth members")
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
                message: "Group is not active"
            });
        }

        // Confirm member belongs to this group
        const isMember = group.members.some(
            m => m.userId.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this group"
            });
        }

        // ── Fetch current bidding round ───────────────────────────────────────
        const round = await BiddingRound.findOne({
            groupId,
            monthNumber: group.currentMonth,
            status: { $in: ["PAYMENT_OPEN", "ADMIN_ROUND"] }
        }).lean();

        if (!round) {
            return res.status(400).json({
                success: false,
                message: "No active payment phase found for this group"
            });
        }

        // ── Type-specific checks ──────────────────────────────────────────────

        if (type === "CONTRIBUTION") {
            // Winner does not pay contribution
            if (round.winnerUserId && round.winnerUserId.toString() === userId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "You are the winner this month and do not need to pay a contribution"
                });
            }

            // Check there is actually something remaining to pay
            const paidAgg = await Transaction.aggregate([
                {
                    $match: {
                        groupId: new mongoose.Types.ObjectId(groupId),
                        userId: new mongoose.Types.ObjectId(userId),
                        monthNumber: group.currentMonth,
                        type: "CONTRIBUTION",
                        status: { $in: ["PENDING", "COMPLETED"] }
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const alreadyAccountedFor = paidAgg[0]?.total || 0;
            const remaining = round.payablePerMember - alreadyAccountedFor;

            if (remaining <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Your contribution for this month is already fully paid"
                });
            }
        }

        if (type === "WINNER_PAYOUT") {
            // Only winner can raise payout request
            if (!round.winnerUserId || round.winnerUserId.toString() !== userId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "Only the winner can raise a payout request"
                });
            }

            const receivedAgg = await Transaction.aggregate([
                {
                    $match: {
                        groupId: new mongoose.Types.ObjectId(groupId),
                        userId: new mongoose.Types.ObjectId(userId),
                        monthNumber: group.currentMonth,
                        type: "WINNER_PAYOUT",
                        status: { $in: ["PENDING", "COMPLETED"] }
                    }
                },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);

            const alreadyAccountedFor = receivedAgg[0]?.total || 0;
            const remaining = round.winnerReceivableAmount - alreadyAccountedFor;

            if (remaining <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Your payout for this month has already been fully processed"
                });
            }
        }

        // ── Notify employees and admin ────────────────────────────────────────
        //
        // Both receive PAYMENT_COLLECTION_REQUEST so whoever is available
        // can act on it. The message includes the member's name, group name,
        // month number, and request type so no additional context is needed.
        const io = req.app.get("io");
        const user = req.user;

        const requestLabel = type === "CONTRIBUTION"
            ? "pay their contribution"
            : "receive their payout";

        const title = "Payment Collection Request 📩";
        const body = `${user.name} (${user.phoneNumber}) wants to ${requestLabel} for "${group.name}" Month ${group.currentMonth}.`;

        // Notify all employees
        notifyAllEmployees(title, body, "PAYMENT_COLLECTION_REQUEST", io, group._id);

        // Notify admin separately so they also have visibility
        notifyAdmins(title, body, "PAYMENT_COLLECTION_REQUEST", io, group._id);

        return res.status(200).json({
            success: true,
            message: "Your request has been sent. An employee will contact you shortly."
        });

    } catch (error) {
        next(error);
    }
};