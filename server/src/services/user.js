const User = require("../models/user.js");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

//method for creating a new user
const createUser = async ({ name, phoneNumber, password }) => {

    //check if user already exists
    if (await User.exists({ phoneNumber })) {
        throw new Error("USER_ALREADY_EXISTS");
    }

    //hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    //create user
    return await User.create({
        name,
        phoneNumber,
        password: hashedPassword
    });
};



module.exports = {
    createUser
};