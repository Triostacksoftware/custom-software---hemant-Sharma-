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

const clientUrls = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : [];

const io = new Server(server, {
    cors: {
        origin: clientUrls,
        methods: ["GET", "POST"],
        credentials: true
    }
});

console.log("Client URLs are:", clientUrls);

app.set("io", io);

app.use(cors({
    origin: clientUrls,
    credentials: true
}));
app.use(express.json());

app.use(userRoutes);
app.use(employeeRoutes);
app.use(adminRoutes);

app.use(errorHandler);

io.on("connection", (socket) => {
    socket.on("joinBiddingRoom", ({ biddingRoundId }) => {
        if (biddingRoundId) {
            socket.join(biddingRoundId.toString());
        }
    });

    socket.on("joinPersonalRoom", ({ id, role }) => {
        if (!id || !role) return;
        const room = `${role}_${id}`;
        socket.join(room);
    });

    socket.on("disconnect", () => {
        // Handle disconnect logic here if needed in the future
    });
});

mongoose.connect(process.env.DATABASE_CONNECTION_STRING)
    .then(() => {
        console.log("Database connection established");
        server.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
            initCronJobs(io);
        });
    })
    .catch((error) => {
        console.error("Database connection error", error);
    });