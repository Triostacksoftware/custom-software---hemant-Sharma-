const cron = require("node-cron");

const BiddingRound = require("./models/biddingRound.js");
const Groups = require("./models/group.js");
const Bid = require("./models/bid.js");
const {
    notifyAdmins,
    notifyGroupMembers,
    notifyAllEmployees,
    notifyMember
} = require("./services/notificationService.js");

// ─────────────────────────────────────────────────────────────────────────────
// All cron jobs run in IST (Asia/Kolkata) using node-cron's timezone option.
// This means cron expressions are written in IST directly — no UTC conversion needed.
//
// Schedule:
//   9:00 AM IST  — morning reminder to admin for today's bidding
//   12:00 PM IST — midday reminder to admin if bidding not yet opened
//   4:00 PM IST  — final reminder to admin (1 hour before auto-open)
//   5:00 PM IST  — auto-open bidding for all groups scheduled today
//   8:00 PM IST  — auto-close all OPEN bidding rounds
// ─────────────────────────────────────────────────────────────────────────────

const TIMEZONE = "Asia/Kolkata";


// ─────────────────────────────────────────────────────────────────────────────
// Helper: get today's date range in IST (start of day to end of day)
// Used to query rounds scheduled for today.
// ─────────────────────────────────────────────────────────────────────────────
function getTodayRangeIST() {
    const now = new Date();

    // IST offset = UTC + 5:30 = 330 minutes
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    // Current time in IST as a Date object (still UTC internally, shifted for calculation)
    const nowIST = new Date(now.getTime() + IST_OFFSET_MS);

    // Start of today in IST: midnight IST → back to UTC for DB query
    const startOfDayIST = new Date(
        Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0)
    );
    const startUTC = new Date(startOfDayIST.getTime() - IST_OFFSET_MS);

    // End of today in IST: 23:59:59 IST → back to UTC
    const endOfDayIST = new Date(
        Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59)
    );
    const endUTC = new Date(endOfDayIST.getTime() - IST_OFFSET_MS);

    return { startUTC, endUTC };
}


// ─────────────────────────────────────────────────────────────────────────────
// Helper: fetch all PENDING rounds scheduled for today with their group names
// ─────────────────────────────────────────────────────────────────────────────
async function getPendingRoundsScheduledToday() {
    const { startUTC, endUTC } = getTodayRangeIST();

    const rounds = await BiddingRound.find({
        status: "PENDING",
        scheduledBiddingDate: { $gte: startUTC, $lte: endUTC }
    })
        .populate("groupId", "name defaultBidTerms totalMembers monthlyContribution")
        .lean();

    return rounds;
}


// ─────────────────────────────────────────────────────────────────────────────
// CRON 1 — 9:00 AM IST daily
// First morning reminder to admin about today's scheduled bidding rounds.
// ─────────────────────────────────────────────────────────────────────────────
function scheduleNineAmReminder(io) {
    cron.schedule("0 9 * * *", async () => {
        console.log("[CRON 9AM] Running bidding day reminder");
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) return;

            for (const round of rounds) {
                const group = round.groupId;
                const minBid = round.minBid || group.defaultBidTerms?.minBid || 0;
                const maxBid = round.maxBid || group.defaultBidTerms?.maxBid || 0;
                const step = round.bidMultiple || group.defaultBidTerms?.bidMultiple || 1;

                await notifyAdmins(
                    `Bidding Today — "${group.name}" 📅`,
                    `Bidding for "${group.name}" Month ${round.monthNumber} is scheduled today at 5:00 PM. Current terms: Min ₹${minBid}, Max ₹${maxBid}, Step ₹${step}. Update terms before 5 PM if needed.`,
                    "BIDDING_REMINDER",
                    io,
                    group._id
                );

                // Also remind all group members that bidding is today
                await notifyGroupMembers(
                    group._id,
                    `Bidding Today at 5 PM 🔔`,
                    `Bidding for "${group.name}" Month ${round.monthNumber} opens today at 5:00 PM. Be ready!`,
                    "BIDDING_REMINDER",
                    io
                );
            }
        } catch (err) {
            console.error("[CRON 9AM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}


// ─────────────────────────────────────────────────────────────────────────────
// CRON 2 — 12:00 PM IST daily
// Midday reminder to admin — 5 hours before auto-open.
// ─────────────────────────────────────────────────────────────────────────────
function scheduleTwelvePmReminder(io) {
    cron.schedule("0 12 * * *", async () => {
        console.log("[CRON 12PM] Running midday bidding reminder");
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) return;

            for (const round of rounds) {
                const group = round.groupId;
                const minBid = round.minBid || group.defaultBidTerms?.minBid || 0;
                const maxBid = round.maxBid || group.defaultBidTerms?.maxBid || 0;
                const step = round.bidMultiple || group.defaultBidTerms?.bidMultiple || 1;

                await notifyAdmins(
                    `Bidding in 5 Hours — "${group.name}" ⏰`,
                    `Reminder: Bidding for "${group.name}" Month ${round.monthNumber} auto-opens at 5:00 PM. Terms set: Min ₹${minBid}, Max ₹${maxBid}, Step ₹${step}. You have until 4:59 PM to update them.`,
                    "BIDDING_REMINDER",
                    io,
                    group._id
                );
            }
        } catch (err) {
            console.error("[CRON 12PM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}


// ─────────────────────────────────────────────────────────────────────────────
// CRON 3 — 4:00 PM IST daily
// Final reminder — 1 hour before auto-open. Last chance to update terms.
// ─────────────────────────────────────────────────────────────────────────────
function scheduleFourPmReminder(io) {
    cron.schedule("0 16 * * *", async () => {
        console.log("[CRON 4PM] Running final bidding reminder");
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) return;

            for (const round of rounds) {
                const group = round.groupId;
                const minBid = round.minBid || group.defaultBidTerms?.minBid || 0;
                const maxBid = round.maxBid || group.defaultBidTerms?.maxBid || 0;
                const step = round.bidMultiple || group.defaultBidTerms?.bidMultiple || 1;

                await notifyAdmins(
                    `🚨 Bidding Opens in 1 Hour — "${group.name}"`,
                    `Final reminder: Bidding for "${group.name}" Month ${round.monthNumber} auto-opens at 5:00 PM with terms Min ₹${minBid}, Max ₹${maxBid}, Step ₹${step}. This is your last chance to update the terms.`,
                    "BIDDING_REMINDER",
                    io,
                    group._id
                );
            }
        } catch (err) {
            console.error("[CRON 4PM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}


// ─────────────────────────────────────────────────────────────────────────────
// CRON 4 — 5:00 PM IST daily
// Auto-open bidding for all PENDING rounds scheduled today.
// Uses terms already stored on the round (from defaultBidTerms or admin override).
// ─────────────────────────────────────────────────────────────────────────────
function scheduleFivePmAutoOpen(io) {
    cron.schedule("0 17 * * *", async () => {
        console.log("[CRON 5PM] Running auto-open bidding");
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) {
                console.log("[CRON 5PM] No rounds to open today");
                return;
            }

            const now = new Date();
            const eightPmIST = new Date();
            // 8 PM IST = now set to 20:00 IST
            // We calculate endedAt as today at 8PM IST in UTC
            const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
            const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
            const eightPmUTC = new Date(
                Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 20, 0, 0)
            );
            const endedAt = new Date(eightPmUTC.getTime() - IST_OFFSET_MS);

            for (const round of rounds) {
                const group = round.groupId;

                // Resolve terms — round fields take priority (admin may have overridden)
                // then fall back to group defaultBidTerms
                const minBid = round.minBid > 0 ? round.minBid : group.defaultBidTerms?.minBid;
                const maxBid = round.maxBid > 0 ? round.maxBid : group.defaultBidTerms?.maxBid;
                const bidMultiple = round.bidMultiple > 1 ? round.bidMultiple : group.defaultBidTerms?.bidMultiple || 1;

                // Skip if terms are still not valid — should not happen if createGroup enforced them
                if (!minBid || !maxBid || minBid <= 0 || maxBid <= 0 || minBid >= maxBid) {
                    console.error(`[CRON 5PM] Invalid bid terms for group ${group.name} — skipping`);

                    await notifyAdmins(
                        `⚠️ Bidding Could Not Open — "${group.name}"`,
                        `Bidding for "${group.name}" Month ${round.monthNumber} could not auto-open. Bid terms are invalid. Please open bidding manually.`,
                        "BIDDING_OPEN",
                        io,
                        group._id
                    );
                    continue;
                }

                // Open the round
                await BiddingRound.findByIdAndUpdate(round._id, {
                    $set: {
                        status: "OPEN",
                        minBid,
                        maxBid,
                        bidMultiple,
                        startedAt: now,
                        endedAt
                    }
                });

                // Emit socket event to bidding room
                io.to(round._id.toString()).emit("biddingOpened", {
                    biddingRoundId: round._id,
                    monthNumber: round.monthNumber,
                    endsAt: endedAt,
                    minBid,
                    maxBid,
                    bidMultiple
                });

                const body = `Bidding is now live for "${group.name}" — Month ${round.monthNumber}. Bids close at 8:00 PM.`;

                await notifyGroupMembers(group._id, "Bidding is Live! 🔨", body, "BIDDING_OPEN", io);
                await notifyAllEmployees("Bidding is Live! 🔨", body, "BIDDING_OPEN", io, group._id);

                console.log(`[CRON 5PM] Opened bidding for ${group.name} Month ${round.monthNumber}`);
            }
        } catch (err) {
            console.error("[CRON 5PM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}


// ─────────────────────────────────────────────────────────────────────────────
// CRON 5 — 8:00 PM IST daily
// Auto-close all OPEN bidding rounds.
// Reuses the same winner calculation logic as the closeBidding controller
// but runs directly without an HTTP request.
// ─────────────────────────────────────────────────────────────────────────────
function scheduleEightPmAutoClose(io) {
    cron.schedule("0 20 * * *", async () => {
        console.log("[CRON 8PM] Running auto-close bidding");
        try {
            const openRounds = await BiddingRound.find({ status: "OPEN" })
                .populate("groupId", "name totalMembers monthlyContribution members")
                .lean();

            if (!openRounds.length) {
                console.log("[CRON 8PM] No open rounds to close");
                return;
            }

            for (const round of openRounds) {
                await autoCloseRound(round, io);
            }
        } catch (err) {
            console.error("[CRON 8PM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}


// ─────────────────────────────────────────────────────────────────────────────
// Helper: autoCloseRound
// Contains the same winner calculation logic as the closeBidding controller.
// Extracted here so it can be called cleanly by the cron job.
// ─────────────────────────────────────────────────────────────────────────────
async function autoCloseRound(round, io) {
    try {
        const group = round.groupId; // already populated

        const bids = await Bid.find({ biddingRoundId: round._id })
            .sort({ bidAmount: -1 })
            .populate("userId", "name")
            .lean();

        // No bids placed
        if (bids.length === 0) {
            await BiddingRound.findByIdAndUpdate(round._id, { $set: { status: "CLOSED" } });

            io.to(round._id.toString()).emit("biddingClosed", { message: "Bidding time expired. No bids placed." });

            await notifyAdmins(
                `Bidding Closed — No Bids — "${group.name}"`,
                `Bidding for "${group.name}" Month ${round.monthNumber} closed at 8 PM with no bids. Please reopen bidding.`,
                "BIDDING_CLOSED",
                io,
                group._id
            );

            console.log(`[CRON 8PM] Closed ${group.name} Month ${round.monthNumber} — no bids`);
            return;
        }

        const highestBidAmount = bids[0].bidAmount;
        const highestBidders = bids.filter(b => b.bidAmount === highestBidAmount);

        // Tie
        if (highestBidders.length > 1) {
            await BiddingRound.findByIdAndUpdate(round._id, { $set: { status: "CLOSED" } });

            io.to(round._id.toString()).emit("biddingClosed", {
                tie: true,
                tiedUsers: highestBidders.map(b => ({
                    userId: b.userId._id,
                    name: b.userId.name,
                    bidAmount: b.bidAmount
                }))
            });

            await notifyAdmins(
                `Bidding Tie — Action Required ⚠️ — "${group.name}"`,
                `A tie was detected in "${group.name}" Month ${round.monthNumber}. Please select the winner from the admin panel.`,
                "BIDDING_TIE",
                io,
                group._id
            );

            console.log(`[CRON 8PM] Tie detected for ${group.name} Month ${round.monthNumber}`);
            return;
        }

        // Single winner
        const winnerBid = highestBidders[0];
        const winningBidAmount = winnerBid.bidAmount;
        const dividendPerMember = Math.floor(winningBidAmount / group.totalMembers);
        const payablePerMember = group.monthlyContribution - dividendPerMember;
        const winnerReceivable = group.totalPoolAmount - winningBidAmount - payablePerMember;

        await BiddingRound.findByIdAndUpdate(round._id, {
            $set: {
                status: "PAYMENT_OPEN",
                winnerUserId: winnerBid.userId._id,
                winningBidAmount,
                dividendPerMember,
                payablePerMember,
                winnerReceivableAmount: winnerReceivable
            }
        });

        // Update winner in group members
        await Groups.updateOne(
            { _id: group._id, "members.userId": winnerBid.userId._id },
            {
                $set: {
                    "members.$.hasWon": true,
                    "members.$.winningMonth": round.monthNumber,
                    "members.$.currentPaymentStatus": "PAID"
                }
            }
        );

        // Set non-winners to PENDING
        await Groups.updateOne(
            { _id: group._id },
            { $set: { "members.$[elem].currentPaymentStatus": "PENDING" } },
            { arrayFilters: [{ "elem.userId": { $ne: winnerBid.userId._id } }] }
        );

        io.to(round._id.toString()).emit("biddingClosed", {
            winnerUserId: winnerBid.userId._id,
            winnerName: winnerBid.userId.name,
            winningBidAmount,
            winnerReceivableAmount: winnerReceivable,
            dividendPerMember,
            payablePerMember
        });

        // Notify members and employees
        await notifyGroupMembers(
            group._id,
            "Bidding Result — Payments Now Open 🎉",
            `Month ${round.monthNumber} bidding is complete for "${group.name}". Please pay your contribution of ₹${payablePerMember}.`,
            "BIDDING_CLOSED",
            io
        );

        await notifyMember(
            winnerBid.userId._id,
            "Congratulations! You Won! 🏆",
            `You won the Month ${round.monthNumber} bid in "${group.name}"! You will receive ₹${winnerReceivable}.`,
            "BIDDING_CLOSED",
            io,
            group._id
        );

        await notifyAllEmployees(
            "Bidding Closed — Collections Open",
            `Month ${round.monthNumber} bidding is complete for "${group.name}". Collections and payout can now begin.`,
            "BIDDING_CLOSED",
            io,
            group._id
        );

        console.log(`[CRON 8PM] Closed ${group.name} Month ${round.monthNumber} — winner: ${winnerBid.userId.name}`);

    } catch (err) {
        console.error(`[CRON 8PM] Error closing round ${round._id}:`, err.message);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// initCronJobs — call this once after DB connects in app.js
//
// Usage in app.js (already has the commented placeholder):
//   const { initCronJobs } = require("./cronJobs");
//   initCronJobs(io);
// ─────────────────────────────────────────────────────────────────────────────
function initCronJobs(io) {
    scheduleNineAmReminder(io);
    scheduleTwelvePmReminder(io);
    scheduleFourPmReminder(io);
    scheduleFivePmAutoOpen(io);
    scheduleEightPmAutoClose(io);

    console.log("Cron jobs initialised — bidding automation active (IST timezone)");
}

module.exports = { initCronJobs };