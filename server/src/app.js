require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const userModel = require("./models/user.js");

const userRoutes = require("./routes/user.js");


const app = express();

app.use(cors());
app.use(express.json());

app.use(userRoutes);

mongoose.connect(process.env.DATABASE_CONNECTION_STRING)
    .then(() => {
        console.log("Database connection established");
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        })
    })
    .catch((error) => {
        console.log("Database connection error", error);
    })