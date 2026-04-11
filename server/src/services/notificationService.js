const webpush = require("web-push");
const Notification = require("../models/notification.js");
const User = require("../models/user.js");
const Employee = require("../models/employee.js");
const Groups = require("../models/group.js");

// ─────────────────────────────────────────────────────────────────────────────
// VAPID setup — configure once when the module loads
// ─────────────────────────────────────────────────────────────────────────────
webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);


// ─────────────────────────────────────────────────────────────────────────────
// Private helper: send a single web push notification
//
// Silently cleans up expired subscriptions (410 = subscription no longer valid).
// All other errors are logged but never thrown — a push failure should never
// crash the controller that triggered the notification.
// ─────────────────────────────────────────────────────────────────────────────
async function _sendPush(subscription, title, body) {
    if (!subscription) return;
    try {
        await webpush.sendNotification(
            subscription,
            JSON.stringify({ title, body })
        );
    } catch (err) {
        if (err.statusCode === 410) {
            // Subscription expired — will be cleaned up by the caller
            throw err;
        }
        console.error("Push send error:", err.message);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Private helper: save notification to DB + send push + emit socket event
//
// recipientId    — MongoDB _id of recipient
// recipientModel — "User" | "Employee"
// title          — notification title
// body           — notification body text
// type           — notification type enum value
// groupId        — optional, for deep-linking
// io             — socket.io instance (pass from req.app.get("io"))
// pushSubscription — the stored subscription object from User/Employee doc
// scheduledAt    — optional, for EMPLOYEE_VISIT_NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
async function _createNotification({
    recipientId,
    recipientModel,
    title,
    body,
    type,
    groupId = null,
    io = null,
    pushSubscription = null,
    scheduledAt = null
}) {
    // 1. Save to Notification collection (in-app inbox)
    await Notification.create({
        recipientId,
        recipientModel,
        title,
        body,
        type,
        groupId,
        scheduledAt,
        isRead: false,
        status: "UNREAD"
    });

    // 2. Emit real-time socket event to personal room
    //    Frontend joins this room on login via joinPersonalRoom event
    if (io) {
        const room = `${recipientModel.toLowerCase()}_${recipientId}`;
        io.to(room).emit("newNotification", { title, body, type, groupId });
    }

    // 3. Send web push to device
    if (pushSubscription) {
        try {
            await _sendPush(pushSubscription, title, body);
        } catch (err) {
            // Subscription expired — clear it from the document
            if (err.statusCode === 410) {
                if (recipientModel === "User") {
                    await User.findByIdAndUpdate(recipientId, {
                        $set: { pushSubscription: null }
                    });
                } else {
                    await Employee.findByIdAndUpdate(recipientId, {
                        $set: { pushSubscription: null }
                    });
                }
            }
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// Each function below is a named notification event.
// Controllers import and call these directly.
// All functions are fire-and-forget safe — errors are caught internally
// so a notification failure never crashes the calling controller.
// ─────────────────────────────────────────────────────────────────────────────


// ── Notify all members of a group ─────────────────────────────────────────────
// Fetches member list + their push subscriptions in one query.
async function notifyGroupMembers(groupId, title, body, type, io) {
    try {
        const group = await Groups.findById(groupId)
            .select("members")
            .lean();

        if (!group?.members?.length) return;

        const memberIds = group.members.map(m => m.userId);

        const users = await User.find({ _id: { $in: memberIds } })
            .select("_id pushSubscription")
            .lean();

        await Promise.allSettled(
            users.map(user =>
                _createNotification({
                    recipientId: user._id,
                    recipientModel: "User",
                    title,
                    body,
                    type,
                    groupId,
                    io,
                    pushSubscription: user.pushSubscription
                })
            )
        );
    } catch (err) {
        console.error(`notifyGroupMembers error [${type}]:`, err.message);
    }
}


// ── Notify all APPROVED employees ─────────────────────────────────────────────
async function notifyAllEmployees(title, body, type, io, groupId = null) {
    try {
        const employees = await Employee.find({
            approvalStatus: "APPROVED",
            role: "EMPLOYEE"
        }).select("_id pushSubscription").lean();

        await Promise.allSettled(
            employees.map(emp =>
                _createNotification({
                    recipientId: emp._id,
                    recipientModel: "Employee",
                    title,
                    body,
                    type,
                    groupId,
                    io,
                    pushSubscription: emp.pushSubscription
                })
            )
        );
    } catch (err) {
        console.error(`notifyAllEmployees error [${type}]:`, err.message);
    }
}


// ── Notify all admins ─────────────────────────────────────────────────────────
async function notifyAdmins(title, body, type, io, groupId = null) {
    try {
        const admins = await Employee.find({
            role: "ADMIN"
        }).select("_id pushSubscription").lean();

        await Promise.allSettled(
            admins.map(admin =>
                _createNotification({
                    recipientId: admin._id,
                    recipientModel: "Employee",
                    title,
                    body,
                    type,
                    groupId,
                    io,
                    pushSubscription: admin.pushSubscription
                })
            )
        );
    } catch (err) {
        console.error(`notifyAdmins error [${type}]:`, err.message);
    }
}


// ── Notify a single member ────────────────────────────────────────────────────
async function notifyMember(userId, title, body, type, io, groupId = null) {
    try {
        const user = await User.findById(userId)
            .select("pushSubscription")
            .lean();

        if (!user) return;

        await _createNotification({
            recipientId: userId,
            recipientModel: "User",
            title,
            body,
            type,
            groupId,
            io,
            pushSubscription: user.pushSubscription
        });
    } catch (err) {
        console.error(`notifyMember error [${type}]:`, err.message);
    }
}


// ── Notify a single employee ──────────────────────────────────────────────────
async function notifyEmployee(employeeId, title, body, type, io, groupId = null) {
    try {
        const employee = await Employee.findById(employeeId)
            .select("pushSubscription")
            .lean();

        if (!employee) return;

        await _createNotification({
            recipientId: employeeId,
            recipientModel: "Employee",
            title,
            body,
            type,
            groupId,
            io,
            pushSubscription: employee.pushSubscription
        });
    } catch (err) {
        console.error(`notifyEmployee error [${type}]:`, err.message);
    }
}


module.exports = {
    notifyGroupMembers,
    notifyAllEmployees,
    notifyAdmins,
    notifyMember,
    notifyEmployee
};