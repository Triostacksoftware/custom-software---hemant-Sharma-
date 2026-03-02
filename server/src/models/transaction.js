const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    groupId: {
        type: Schema.Types.ObjectId,
        ref: "Groups",
        required: true,
        index: true
    },

    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    biddingRoundId: {
        type: Schema.Types.ObjectId,
        ref: "BiddingRound",
        required: true,
        index: true
    },

    monthNumber: {
        type: Number,
        required: true,
        min: 1,
        index: true
    },

    type: {
        type: String,
        enum: ["CONTRIBUTION", "WINNER_PAYOUT"],
        required: true,
        index: true
    },

    amount: {
        type: Number,
        required: true,
        min: 1
    },

    paymentMode: {
        type: String,
        enum: ["CASH", "UPI", "INTERNET_BANKING", "CHEQUE"],
        required: true
    },

    handledBy: {
        type: Schema.Types.ObjectId,
        ref: "Employee",
        required: true
    },

    handledAt: {
        type: Date,
        default: Date.now
    },

    remarks: {
        type: String,
        trim: true
    },

    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "Employee"
    }

}, { timestamps: true });

transactionSchema.index({ groupId: 1, monthNumber: 1 });
transactionSchema.index({ userId: 1, monthNumber: 1 });
transactionSchema.index({ type: 1, groupId: 1, monthNumber: 1 });


module.exports = mongoose.model("Transaction", transactionSchema);