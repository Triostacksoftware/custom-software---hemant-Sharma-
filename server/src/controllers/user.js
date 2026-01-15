const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userService = require("../services/user.js");
const User = require("../models/user.js");


//controller function to register a new user
exports.userSignup = async (req, res, next) => {

    try {
        const { name, phoneNumber, password } = req.body;

        //form data validation
        if (!name || !phoneNumber || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        await userService.createUser({ name, phoneNumber, password });

        res.status(201).json({ message: "User created successfully", success: true });

    } catch (error) {
        if (error.message === "USER_ALREADY_EXISTS") {
            return res.status(409).json({ error: "User already exists" });

        }
        console.log("User creation error: ", error);
        res.status(500).json({ error: "Internal server error" });
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
        console.log("Login error: ", error);
        res.status(500).json({ error: "Internal server error" });

    }
};