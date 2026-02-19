const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bidSchema = new Schema({
    biddingRoundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BiddingRound",
        required: true,
        index: true,
    },
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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    bidAmount: {
        type: Number,
        required: true,
        min: 0,
    }

}, { timestamps: true });


bidSchema.index({ biddingRoundId: 1, userId: 1 }, { unique: true });


module.exports = mongoose.model("Bid", bidSchema);