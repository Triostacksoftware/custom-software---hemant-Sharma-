const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const biddingRoundSchema = new Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Groups",
        required: true,
        index: true,
    },
    monthNumber: {
        type: Number,
        required: true,
        min: 1,
    },
    status: {
        type: String,
        enum: ["PENDING", "OPEN", "CLOSED", "FINALIZED"],
        default: "PENDING",
        index: true,
    },
    totalPoolAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    winnerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    winningBidAmount: {
        type: Number,
        default: 0,
    },
    dividendPerMember: {
        type: Number,
        default: 0,
    },
    payoutAmount: {
        type: Number,
        default: 0,
    },
    startedAt: Date,
    endedAt: Date,
    finalizedAt: Date,

}, { timestamps: true });

biddingRoundSchema.index({ groupId: 1, monthNumber: 1 }, { unique: true });


module.exports = mongoose.model("BiddingRound", biddingRoundSchema);