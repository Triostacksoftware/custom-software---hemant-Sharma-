const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Employee = require("../models/employee.js");
const Groups = require("../models/group.js");



//create login token using jwt
function generateAccessToken(id, name) {
    return jwt.sign(
        { employeeId: id, name: name },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
    );
}

//controller handling admin login
exports.adminLogin = async (req, res, next) => {
    try {
        const { phoneNumber, password } = req.body;
        //form data validation
        if (!phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //admins are registered in the employee table with the role as admin.
        //check if the admin exists or not
        const employee = await Employee.findOne({ phoneNumber });
        if (!employee) {
            return res.status(409).json({ error: "Admin does not exist" });
        }

        //check approval status
        if (employee.approvalStatus !== "APPROVED") {
            return res.status(403).json({ error: "Awaiting approval from admin" });
        }

        //check if the employee is an admin or not
        if (employee.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });
        }

        const passwordMatch = await bcrypt.compare(password, employee.password);  //compare the password
        if (!passwordMatch) {
            return res.status(400).json({ error: "Incorrect password" });
        }

        return res.status(200).json({
            message: "Login successful",
            success: true,
            token: generateAccessToken(employee._id, employee.name)
        });

    } catch (error) {
        console.log("Admin login error ", error);
        res.status(500).json({ error: "Internal server error" });

    }
};

//controller for creating groups
exports.createGroup = async (req, res, next) => {
    try {
        const { name, totalMembers, totalMonths, monthlyContribution } = req.body;

        //form data validation
        if (!name || !totalMembers || !totalMonths || !monthlyContribution) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        //business logic validation
        if (totalMembers !== totalMonths) {
            return res.status(400).json({
                success: false,
                message: "Total members must be equal to total months"
            });
        }

        if (monthlyContribution <= 0) {
            return res.status(400).json({
                success: false,
                message: "Monthly contribution must be greater than zero"
            });
        }

        //create group in DRAFT state
        const group = await Groups.create({
            name,
            totalMembers,
            totalMonths,
            monthlyContribution,
            members: [],
            currentMonth: 1,
            status: "DRAFT"
        });

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            groupId: group._id
        });

    } catch (error) {
        console.log("Group creation error: ", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}


