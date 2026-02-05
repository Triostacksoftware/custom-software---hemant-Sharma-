require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const userModel = require("./models/user.js");
const employeeModel = require("./models/employee.js");
const groupModel = require("./models/group.js");

const errorHandler = require("./middleware/error_handler.js");

const userRoutes = require("./routes/user.js");
const employeeRoutes = require("./routes/employee.js");
const adminRoutes = require("./routes/admin.js");

const app = express();

app.use(cors());
app.use(express.json());

app.use(userRoutes);
app.use(employeeRoutes);
app.use(adminRoutes);


app.use(errorHandler);

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