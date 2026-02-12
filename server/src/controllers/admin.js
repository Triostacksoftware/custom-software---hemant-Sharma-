const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const Employee = require("../models/employee.js");
const Groups = require("../models/group.js");
const User = require("../models/user.js");



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

        next(error);
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

        next(error);
    }
}

//controller for adding members to group
exports.addMemberToGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;   //groupId to be sent as query params
        const { userId } = req.body;      //userId on request body, can be configured later

        //validate IDs
        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid groupId or userId" });

        }
        //fetch group
        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        //check group status(member can;t be added if group is no in DRAFT state)
        if (group.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Members can only be added while group is in DRAFT state"
            });
        }

        //check capacity of group (number of members should not be greater than totalMembers)
        if (group.members.length >= group.totalMembers) {
            return res.status(400).json({
                success: false,
                message: "Group member limit reached"
            });
        }

        //fetch users
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        //only approved users can be added to groups
        if (user.approvalStatus !== "APPROVED") {
            return res.status(403).json({
                success: false,
                message: "User is not approved"
            });
        }

        //prevent duplicate member addition
        const alreadyMember = group.members.some(
            member => member.userId.toString() === userId
        );

        if (alreadyMember) {
            return res.status(409).json({
                success: false,
                message: "User already added to this group"
            });
        }

        //add member
        group.members.push({
            userId,
            hasWon: false,
            totalPaid: 0,
            totalReceived: 0,
            status: "ACTIVE"
        });

        await group.save();

        return res.status(200).json({
            success: true,
            message: "Member added to group successfully",
            currentCount: group.members.length
        });


    } catch (error) {

        next(error);

    }
};


//controller to activate a group
exports.activateGroup = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        //validate groupId
        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: "Group ID is required"
            });
        }

        //fetch group
        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        //group must be in DRAFT
        if (group.status !== "DRAFT") {
            return res.status(400).json({
                success: false,
                message: "Only DRAFT groups can be activated"
            });
        }

        //member count must match
        if (group.members.length !== group.totalMembers) {
            return res.status(400).json({
                success: false,
                message: "Group must have all members before activation"
            });
        }

        //activate group
        group.status = "ACTIVE";

        group.startDate = new Date();

        await group.save();

        return res.status(200).json({
            success: true,
            message: "Group activated successfully",
            startDate: group.startDate
        });

    } catch (error) {

        next(error);
    }
};


//controller to fetch all the members
exports.getMembers = async (req, res, next) => {
    try {

        //raw values from query
        const { page, limit, search } = req.query;

        //Sanitize the values
        const currentPage = Math.max(1, Number(page) || 1);
        const resultsPerPage = Math.max(1, Number(limit) || 10);
        const searchTerm = search?.trim() || "";

        //calculate number of documents to skip
        const skipAmount = (currentPage - 1) * resultsPerPage;

        //build the search filter
        const queryFilter = searchTerm
            ? {
                $or: [
                    { name: { $regex: searchTerm, $options: "i" } },
                    { phoneNumber: { $regex: searchTerm, $options: "i" } }
                ]
            }
            : {};

        const [members, totalMembers] = await Promise.all([
            User.find(queryFilter)
                .select("-password")  //never send passwords
                .sort({ createdAt: -1 })
                .skip(skipAmount)
                .limit(resultsPerPage),
            User.countDocuments(queryFilter)
        ]);

        return res.status(200).json({
            success: true,
            message: "Members fetched successfully",
            data: {
                members,
                pagination: {
                    total: totalMembers,
                    currentPage,
                    totalPages: Math.ceil(totalMembers / resultsPerPage),
                },
            },
        });

    } catch (error) {
        next(error);
    }
};