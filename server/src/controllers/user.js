const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/user.js");
const BiddingRound = require("../models/biddingRound.js");
const Bid = require("../models/bid.js");
const Groups = require("../models/group.js");
const Transaction = require("../models/transaction.js");
const Employee = require("../models/employee.js");


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
exports.getUserDashboard = async (req, res, next) => {
    try {

        const userId = req.user._id;

        // Fetch user basic details
        const user = await User.findById(userId)
            .select("name phoneNumber email")
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Fetch all groups where user is a member
        const groups = await Groups.find({
            "members.userId": userId
        }).lean();

        if (!groups.length) {
            return res.status(200).json({
                success: true,
                data: {
                    user,
                    stats: {
                        totalGroups: 0,
                        totalContribution: 0,
                        totalWinnings: 0,
                        pendingPayment: 0
                    },
                    groups: []
                }
            });
        }

        const groupIds = groups.map(g => g._id);

        // Fetch all transactions for the user in those groups
        const transactions = await Transaction.find({
            userId,
            groupId: { $in: groupIds }
        }).lean();

        // Fetch rounds where the user won
        const winningRounds = await BiddingRound.find({
            groupId: { $in: groupIds },
            winnerUserId: userId
        }).lean();

        // Map groupId -> winning round
        const winningMap = new Map();
        winningRounds.forEach(round => {
            winningMap.set(round.groupId.toString(), round);
        });

        let totalContribution = 0;
        let totalWinnings = 0;
        let pendingPayment = 0;

        // Calculate stats from transactions
        transactions.forEach(tx => {

            if (tx.type === "CONTRIBUTION" && tx.status === "COMPLETED") {
                totalContribution += tx.amount;
            }

            if (tx.type === "WINNER_PAYOUT" && tx.status === "COMPLETED") {
                totalWinnings += tx.amount;
            }

            if (tx.status !== "COMPLETED") {
                pendingPayment += tx.amount;
            }

        });

        // Build group cards
        const groupCards = await Promise.all(groups.map(async (group) => {
            const winningRound = winningMap.get(group._id.toString());

            // Find current bidding round for this group
            const currentRound = await BiddingRound.findOne({
                groupId: group._id,
                monthNumber: group.currentMonth
            }).lean();

            const groupData = {
                groupId: group._id,
                name: group.name,
                status: group.status,
                memberCount: group.members?.length || 0,
                monthlyContribution: group.monthlyContribution,
                currentMonth: group.currentMonth,
                totalMonths: group.totalMonths,
                hasWon: !!winningRound,
                biddingStatus: currentRound ? currentRound.status : 'NOT_CREATED',
            };

            if (winningRound) {
                groupData.winningAmount = winningRound.winnerReceivableAmount || 0;
            }

            return groupData;
        }));

        return res.status(200).json({
            success: true,
            data: {
                user,
                stats: {
                    totalGroups: groups.length,
                    totalContribution,
                    totalWinnings,
                    pendingPayment
                },
                groups: groupCards,
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

        // ── FIX: Build bidding history from the Bid collection ────────────────
        //
        // Previously this code read userBid from round.bids[]:
        //   const userBid = round.bids?.find(b => b.userId.toString() === userId.toString())
        //
        // But bids are stored in a separate Bid collection, NOT embedded in the
        // BiddingRound document. So round.bids was always undefined, userBid was
        // always null, and "Your Bid" showed "—" for every past round.
        //
        // Fix: fetch all Bid documents for past rounds in one query, build a
        // roundId → bidAmount map, then look up each round from that map.
        // ─────────────────────────────────────────────────────────────────────
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