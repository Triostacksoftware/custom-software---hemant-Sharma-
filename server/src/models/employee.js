const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

const employeeSchema = new Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
    },
    phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
        unique: true,
        validate: {
            validator: v => PHONE_REGEX.test(v),   // This regex validates E.164 format (e.g. +1234567890)
            message: ({ value }) => `${value} is not a valid phone number`
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
    }
}, { timestamps: true });

module.exports = mongoose.model("Employee", employeeSchema);

