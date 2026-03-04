require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const userModel = require("./models/user.js");
const employeeModel = require("./models/employee.js");
const groupModel = require("./models/group.js");
const transactionModel = require("./models/transaction.js");

const errorHandler = require("./middleware/error_handler.js");

const userRoutes = require("./routes/user.js");
const employeeRoutes = require("./routes/employee.js");
const adminRoutes = require("./routes/admin.js");
const { Socket } = require("dgram");

const app = express();

//creating http server
const server = http.createServer(app);

//attaching socket.io
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

//make io globally accessible
app.set("io", io);

app.use(cors());
app.use(express.json());

app.use(userRoutes);
app.use(employeeRoutes);
app.use(adminRoutes);

app.use(errorHandler);

//socket connection logic
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    //join bidding room
    socket.on("joinBiddingRoom", ({ biddingRoundId }) => {
        socket.join(biddingRoundId);
        console.log(`Socket ${socket.id} joined room ${biddingRoundId}`);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

mongoose.connect(process.env.DATABASE_CONNECTION_STRING)
    .then(() => {
        console.log("Database connection established");
        server.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        })
    })
    .catch((error) => {
        console.log("Database connection error", error);
    })