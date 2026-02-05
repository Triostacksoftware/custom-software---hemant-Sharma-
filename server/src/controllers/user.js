const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/user.js");

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;


//controller function to register a new user
exports.userSignup = async (req, res, next) => {

    try {
        const { name, phoneNumber, password } = req.body;

        //form data validation
        if (!name || !phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if user already exists
        if (await User.exists({ phoneNumber })) {
            return res.status(409).json({ error: "User already exists" });
        }

        //hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        //create user
        await User.create({
            name,
            phoneNumber,
            password: hashedPassword,
            approvalStatus: "PENDING"
        });

        res.status(201).json({ message: "User creation successful. Awaiting admin approval", success: true });

    } catch (error) {
        next(error);
    }
}


//create login token using jwt
function generateAccessToken(id, name) {
    return jwt.sign(
        { userId: id, name: name },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
    );
}

//controller function for user login
exports.userLogin = async (req, res, next) => {
    try {
        const { phoneNumber, password } = req.body;

        //form data validation
        if (!phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        //check if the user exists or not
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(409).json({ error: "User does not exist" });
        }

        if (user.approvalStatus !== "APPROVED") {
            return res.status(403).json({ error: "Awaiting admin approval" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);  //compare the password
        if (!passwordMatch) {
            return res.status(400).json({ error: "Incorrect password" });
        }

        return res.status(200).json({
            message: "Login successful",
            success: true,
            token: generateAccessToken(user._id, user.name)
        });


    } catch (error) {
        next(error);

    }
};