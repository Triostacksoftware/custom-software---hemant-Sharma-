const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const contributionSchema = new Schema({
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

    monthNumber: {
        type: Number,
        required: true,
        min: 1
    },

    amountPaid: {
        type: Number,
        required: true,
        min: 1
    },

    paymentMode: {
        type: String,
        enum: ["CASH", "UPI", "INTERNET_BANKING", "CHEQUE"],
        required: true
    },

    collectedBy: {
        type: Schema.Types.ObjectId,
        ref: "Employee",
        required: true
    },

    collectedAt: {
        type: Date,
        default: Date.now
    },

    remarks: {
        type: String,
        trim: true
    }

}, { timestamps: true });


module.exports = mongoose.model("Contribution", contributionSchema);