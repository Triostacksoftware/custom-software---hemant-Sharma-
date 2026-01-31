const jwt = require("jsonwebtoken");

const Employee = require("../models/employee.js");



//jwt authentication for employee and admin
exports.authenticate = async (req, res, next) => {
    try {

        const authHeader = req.headers.authorization;   //grab token from header
        //validate token
        if (!authHeader) {
            return res.status(401).json({ error: "Authorization token missing" });

        }
        const token = authHeader.split(" ")[1];

        //verify token
        const tokenDecoded = jwt.verify(token, process.env.JWT_SECRET);

        //fetch employee from db
        const employee = await Employee.findById(tokenDecoded.employeeId);

        if (!employee) {
            return res.status(401).json({ error: "Invalid token user" });
        }

        //approval check
        if (employee.approvalStatus !== "APPROVED") {
            return res.status(403).json({ error: "Account not approved" });
        }

        req.employee = employee;

        next();

    } catch (error) {
        console.log("Authentication error: ", error);
        res.status(401).json({ error: "Authentication failed" });
    }
};



//role check middleware for admin only routes
exports.isAdmin = (req, res, next) => {
    if (!req.employee) {
        return res.status(401).json({ error: "Not authenticated" });

    }

    if (req.employee.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin access required" });

    }

    next();
};