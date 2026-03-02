const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const groupSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    totalMembers: {
        type: Number,
        required: true,
        min: 2,
    },
    totalMonths: {
        type: Number,
        required: true
    },
    monthlyContribution: {
        type: Number,
        required: true,
    },

    members: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        hasWon: {
            type: Boolean,
            default: false,
        },
        winningMonth: {
            type: Number,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "DEFAULTED"],
            default: "ACTIVE",
        },
        currentPaymentStatus: {
            type: String,
            enum: ["PENDING", "PARTIAL", "PAID", "OVERDUE"],
            default: "PENDING"
        }
    }],

    currentMonth: {
        type: Number,
        default: 1,
    },
    status: {
        type: String,
        enum: ["DRAFT", "ACTIVE", "COMPLETED"],
        default: "DRAFT"
    },

    startDate: Date,
    endDate: Date,

}, { timestamps: true });


module.exports = mongoose.model("Groups", groupSchema);