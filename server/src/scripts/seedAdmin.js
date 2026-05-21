const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

// Load dotenv environment variables. Supports both server/.env and root/.env
let envPath = path.resolve(__dirname, "../../.env");
if (!fs.existsSync(envPath)) {
    envPath = path.resolve(__dirname, "../../../.env");
}
require("dotenv").config({ path: envPath });

const Employee = require("../models/employee");

const ADMIN_NAME = "System Admin";
const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD_RAW = "admin@123";
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

async function seed() {
    const dbUrl = process.env.DATABASE_CONNECTION_STRING;
    if (!dbUrl) {
        console.error("Error: DATABASE_CONNECTION_STRING is not defined in the loaded environment variables.");
        console.error(`Attempted env file path: ${envPath}`);
        process.exit(1);
    }

    console.log("Attempting database connection...");
    try {
        await mongoose.connect(dbUrl);
        console.log("Database connection established successfully.");

        // Check if admin already exists by email/phone
        let admin = await Employee.findOne({ phoneNumber: ADMIN_EMAIL });
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD_RAW, SALT_ROUNDS);

        if (admin) {
            console.log(`Admin user with email '${ADMIN_EMAIL}' already exists. Updating password and permissions...`);
            admin.name = ADMIN_NAME;
            admin.password = hashedPassword;
            admin.role = "ADMIN";
            admin.approvalStatus = "APPROVED";
            await admin.save();
            console.log("Admin user updated successfully.");
        } else {
            console.log(`Creating new Admin user with email '${ADMIN_EMAIL}'...`);
            admin = await Employee.create({
                name: ADMIN_NAME,
                phoneNumber: ADMIN_EMAIL,
                password: hashedPassword,
                approvalStatus: "APPROVED",
                role: "ADMIN"
            });
            console.log("Admin user created successfully.");
        }
    } catch (error) {
        console.error("Seeding failed with error:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from database.");
    }
}

seed();
