const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema({

    // The person receiving this notification.
    // Can be a User (member) or an Employee (employee or admin).
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    recipientModel: {
        type: String,
        enum: ["User", "Employee"],
        required: true
    },

    title: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },

    type: {
        type: String,
        enum: [
            //Group lifecycle
            "GROUP_ACTIVATED",          // members: group has started, month 1 is open
            "MEMBER_ADDED_TO_GROUP",    // member: admin added you to a group
            "GROUP_FINALIZED",          // members: month completed, next month started

            //Bidding
            "BIDDING_OPEN",             // members + employees: bidding is now open
            "BIDDING_REMINDER",         // members: morning reminder on bidding day
            "BIDDING_CLOSED",           // members + employees: bidding closed, winner declared
            "BIDDING_TIE",              // admin: tie detected, resolution needed

            //Payments
            "PAYMENT_REMINDER",         // members: reminder to pay after bidding closes
            "PAYMENT_CONFIRMED",        // member: their payment has been verified by employee
            "FINALIZE_BLOCKED",         // admin: payments incomplete, cannot finalize

            //Join requests
            "GROUP_JOIN_REQUEST",       // admin: a member requested to join a group
            "GROUP_JOIN_APPROVED",      // member: their join request was approved
            "GROUP_JOIN_REJECTED",      // member: their join request was rejected

            //Payment collection coordination
            // Member requests employee to come and collect their payment
            "PAYMENT_COLLECTION_REQUEST",
            // Employee notifies member that he is coming to collect / deliver payment
            "EMPLOYEE_VISIT_NOTIFICATION"
        ],
        required: true,
        index: true
    },

    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Groups",
        default: null
    },

    isRead: {
        type: Boolean,
        default: false,
        index: true
    },

    status: {
        type: String,
        enum: ["UNREAD", "READ", "ACKNOWLEDGED"],
        default: "UNREAD"
    },

    // Used only for EMPLOYEE_VISIT_NOTIFICATION.
    // Employee can optionally specify when they plan to visit.
    scheduledAt: {
        type: Date,
        default: null
    }

}, { timestamps: true });

// Fast lookup for a user's unread count (used for the bell badge)
notificationSchema.index({ recipientId: 1, isRead: 1 });

// Fast lookup for a user's inbox sorted by newest first
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);