const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ─────────────────────────────────────────────────────────────────────────────
// CashTransfer — tracks physical cash handoffs between employees.
//
// Use case: Employee A has collected more cash than needed for a payout near
// them. Employee B is physically closer to the winner. A transfers cash to B
// so B can complete the payout. This keeps total cash in hand unchanged across
// the operation but gives per-employee visibility.
//
// Flow:
//   Employee A initiates → status: PENDING → B gets notification
//   Employee B confirms  → status: CONFIRMED → both records update
// ─────────────────────────────────────────────────────────────────────────────
const cashTransferSchema = new Schema({

    // Employee who is sending the cash
    fromEmployeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
        index: true
    },

    // Employee who is receiving the cash
    toEmployeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
        index: true
    },

    amount: {
        type: Number,
        required: true,
        min: 1
    },

    // Optional context — helps admin and employees understand why
    // the transfer happened (e.g. "Payout to winner in Group X Month 3")
    reason: {
        type: String,
        trim: true,
        default: null
    },

    status: {
        type: String,
        enum: ["PENDING", "CONFIRMED", "CANCELLED"],
        default: "PENDING",
        index: true
    },

    confirmedAt: {
        type: Date,
        default: null
    }

}, { timestamps: true });

// Fast lookup for per-employee cash transfer history
cashTransferSchema.index({ fromEmployeeId: 1, createdAt: -1 });
cashTransferSchema.index({ toEmployeeId: 1, createdAt: -1 });

// Fast lookup for pending transfers awaiting confirmation
cashTransferSchema.index({ toEmployeeId: 1, status: 1 });

module.exports = mongoose.model("CashTransfer", cashTransferSchema);