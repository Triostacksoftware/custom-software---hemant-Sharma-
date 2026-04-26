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
const notificationModel = require("./models/notification.js");
const adsModel = require("./models/ads.js");

const errorHandler = require("./middleware/error_handler.js");

const userRoutes = require("./routes/user.js");
const employeeRoutes = require("./routes/employee.js");
const adminRoutes = require("./routes/admin.js");

const { initCronJobs } = require("./cronJobs");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set("io", io);

app.use(cors());
app.use(express.json());

app.use(userRoutes);
app.use(employeeRoutes);
app.use(adminRoutes);

app.use(errorHandler);

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("joinBiddingRoom", ({ biddingRoundId }) => {
        socket.join(biddingRoundId.toString());
        console.log(`Socket ${socket.id} joined bidding room ${biddingRoundId}`);
    });

    socket.on("joinPersonalRoom", ({ id, role }) => {
        if (!id || !role) return;
        const room = `${role}_${id}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined personal room ${room}`);
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

            // Initialize cron jobs after DB connects and server starts
            initCronJobs(io);
        });
    })
    .catch((error) => {
        console.log("Database connection error", error);
    });