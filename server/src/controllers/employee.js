const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Employee = require("../models/employee.js");
const Groups = require("../models/group.js");
const Contribution = require("../models/contribution.js");
const User = require("../models/user.js");

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

//controller function to register a new user
exports.employeeSignup = async (req, res, next) => {

    try {
        const { name, phoneNumber, password } = req.body;

        //form data validation
        if (!name || !phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if employee already exists
        if (await Employee.exists({ phoneNumber })) {
            return res.status(409).json({ error: "Employee already exists" });
        }

        //hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        await Employee.create({
            name,
            phoneNumber,
            password: hashedPassword,
            approvalStatus: "PENDING"
        });

        res.status(201).json({ message: "Signup successful. Awaiting admin approval", success: true });

    } catch (error) {

        next(error);
    }
}


//create login token using jwt
function generateAccessToken(id, name) {
    return jwt.sign(
        { employeeId: id, name: name },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
    );
}

//controller function for employee login
exports.employeeLogin = async (req, res, next) => {
    try {
        const { phoneNumber, password } = req.body;

        //form data validation
        if (!phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if the employee exists or not
        const employee = await Employee.findOne({ phoneNumber });
        if (!employee) {
            return res.status(409).json({ error: "Employee does not exist" });
        }

        if (employee.approvalStatus !== "APPROVED") {
            return res.status(403).json({ error: "Awaiting approval from admin" });
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


//controller to log contributions of members
exports.logContribution = async (req, res, next) => {
    try {

        const { groupId, userId, monthNumber, amountPaid, paymentMode, remarks, collectedAt } = req.body;

        const employeeId = req.employee._id; // from JWT

        //basic validation
        if (!groupId || !userId || !monthNumber || !amountPaid || !paymentMode) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        //validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid groupId or userId"
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

        //group must be ACTIVE
        if (group.status !== "ACTIVE") {
            return res.status(400).json({
                success: false,
                message: "Contributions allowed only for ACTIVE groups"
            });
        }

        //month validation
        if (monthNumber !== group.currentMonth) {
            return res.status(400).json({
                success: false,
                message: "Invalid month number for this group"
            });
        }

        //check user's existence
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        //check member exists in group
        const isMember = group.members.some(
            member => member.userId.toString() === userId
        );

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "User is not a member of this group"
            });
        }

        //create contribution record
        await Contribution.create({
            groupId,
            userId,
            monthNumber,
            amountPaid,
            paymentMode,
            collectedBy: employeeId,
            remarks,
            collectedAt
        });

        return res.status(201).json({
            success: true,
            message: "Contribution logged successfully"
        });

    } catch (error) {

        next(error);

    }
};