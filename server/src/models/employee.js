const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const employeeSchema = new Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
    },
    phoneNumber: {
        type: String,
        required: [true, "Phone number or email is required"],
        trim: true,
        unique: true,
        validate: {
            validator: v => PHONE_REGEX.test(v) || EMAIL_REGEX.test(v),   // Validates E.164 phone format or email format
            message: ({ value }) => `${value} is not a valid phone number or email`
        }
    },
    password: {
        type: String,
        required: [true, "Password is required"]
    },

    approvalStatus: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "PENDING"
    },

    role: {
        type: String,
        enum: ["EMPLOYEE", "ADMIN"],
        default: "EMPLOYEE"
    },

    pushSubscription: {
        type: Object,
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);

