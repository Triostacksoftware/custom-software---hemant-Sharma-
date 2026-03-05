const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/user.js");
const BiddingRound = require("../models/biddingRound.js");
const Bid = require("../models/bid.js");
const Groups = require("../models/group.js");


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


//controller to confirm transaction (contribution and payout both)
exports.confirmTransaction = async (req, res, next) => {
    try {

        const { groupId, biddingRoundId, monthNumber, amount, type } = req.body;

        const userId = req.user._id;

        //basic validation
        if (!groupId || !monthNumber || !amount || !type) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        //object validation
        if (!mongoose.Types.ObjectId.isValid(biddingRoundId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid biddingRoundId"
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

        //validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId"
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

        if (group.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Group not active"
            });
        }

        //check membership
        const member = group.members.find(
            m => m.userId.toString() === userId.toString()
        );

        if (!member) {
            return res.status(403).json({
                success: false,
                message: "User not member of this group"
            });
        }

        //fetch bidding round
        const round = await BiddingRound.findById(biddingRoundId);
        // const round = await BiddingRound.findOne({
        //     groupId,
        //     monthNumber
        // });

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

        if (round.groupId.toString() !== groupId || round.monthNumber !== monthNumber) {
            return res.status(400).json({
                success: false,
                message: "Round does not belong to this group/month"
            });
        }

        //CONTRIBUTION validation
        if (type === "CONTRIBUTION") {

            if (round.winnerUserId.toString() === userId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "Winner does not pay contribution"
                });
            }

            //existing confirmed + completed contributions
            const previousTransactions = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "CONTRIBUTION",
                status: { $in: ["USER_CONFIRMED", "COMPLETED"] }
            }).select("amount").lean();

            const total = previousTransactions.reduce(
                (sum, t) => sum + t.amount,
                0
            );

            if (total + amount > round.payablePerMember) {
                return res.status(400).json({
                    success: false,
                    message: `Contribution exceeds limit. Current: ${total}/${round.payablePerMember}`
                });
            }

        }

        //WINNER PAYOUT validation
        if (type === "WINNER_PAYOUT") {

            if (round.winnerUserId.toString() !== userId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "Only winner receives payout"
                });
            }

            const winnerReceivable =
                round.totalPoolAmount - round.winningBidAmount;

            const previousPayouts = await Transaction.find({
                groupId,
                userId,
                monthNumber,
                type: "WINNER_PAYOUT",
                status: { $in: ["USER_CONFIRMED", "COMPLETED"] }
            }).select("amount").lean();

            const total = previousPayouts.reduce(
                (sum, t) => sum + t.amount,
                0
            );

            if (total + amount > winnerReceivable) {
                return res.status(400).json({
                    success: false,
                    message: `Payout exceeds receivable amount. Current: ${total}/${winnerReceivable}`
                });
            }

        }

        //create confirmation transaction
        await Transaction.create({
            groupId,
            userId,
            biddingRoundId,
            monthNumber,
            amount,
            type,
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