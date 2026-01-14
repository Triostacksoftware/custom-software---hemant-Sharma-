const userService = require("../services/user.js");

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