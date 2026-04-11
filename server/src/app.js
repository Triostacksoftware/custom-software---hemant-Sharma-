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

const app = express();

// Creating http server
const server = http.createServer(app);

// Attaching socket.io
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Make io globally accessible
app.set("io", io);

app.use(cors());
app.use(express.json());

app.use(userRoutes);
app.use(employeeRoutes);
app.use(adminRoutes);

app.use(errorHandler);

// ── Socket connection logic ───────────────────────────────────────────────────
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join bidding room — for live bid updates
    socket.on("joinBiddingRoom", ({ biddingRoundId }) => {
        socket.join(biddingRoundId.toString());
        console.log(`Socket ${socket.id} joined bidding room ${biddingRoundId}`);
    });

    // ── NEW: Join personal notification room ──────────────────────────────────
    //
    // Each user/employee joins their own room on login so the notification
    // service can emit real-time newNotification events directly to them.
    //
    // Room naming convention:
    //   Members   → "user_{userId}"
    //   Employees → "employee_{employeeId}"
    //   Admins    → "employee_{adminId}"  (admin is in Employee model)
    //
    // Frontend calls this immediately after login:
    //   socket.emit("joinPersonalRoom", { id: userId, role: "user" })
    //   socket.emit("joinPersonalRoom", { id: employeeId, role: "employee" })
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


// ── Database connection + server start ───────────────────────────────────────
mongoose.connect(process.env.DATABASE_CONNECTION_STRING)
    .then(() => {
        console.log("Database connection established");
        server.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);

            // TODO: initialize cron jobs here after cronJobs.js is built
            // const { initCronJobs } = require("./cronJobs");
            // initCronJobs(io);
        });
    })
    .catch((error) => {
        console.log("Database connection error", error);
    });