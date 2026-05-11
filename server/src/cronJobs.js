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

// All cron jobs run in Indian Standard Time (IST)
const TIMEZONE = "Asia/Kolkata";

/**
 * Helper: Calculates the start and end of the current day in UTC, 
 * adjusted for the IST timezone. Used to query today's scheduled rounds.
 */
function getTodayRangeIST() {
    const now = new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    // Shift current UTC time to IST internally for calculation
    const nowIST = new Date(now.getTime() + IST_OFFSET_MS);

    // Get 00:00:00 and 23:59:59 in IST, then shift back to UTC for MongoDB queries
    const startOfDayIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 0, 0, 0));
    const startUTC = new Date(startOfDayIST.getTime() - IST_OFFSET_MS);

    const endOfDayIST = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 23, 59, 59));
    const endUTC = new Date(endOfDayIST.getTime() - IST_OFFSET_MS);

    return { startUTC, endUTC };
}

/**
 * Helper: Fetches all PENDING bidding rounds scheduled for today.
 */
async function getPendingRoundsScheduledToday() {
    const { startUTC, endUTC } = getTodayRangeIST();

    return await BiddingRound.find({
        status: "PENDING",
        scheduledBiddingDate: { $gte: startUTC, $lte: endUTC }
    })
        .populate("groupId", "name defaultBidTerms totalMembers monthlyContribution")
        .lean();
}

/**
 * CRON 1: 9:00 AM IST 
 * Initial morning reminder to admins and members about today's bidding.
 */
function scheduleNineAmReminder(io) {
    cron.schedule("0 9 * * *", async () => {
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) return;

            for (const round of rounds) {
                const group = round.groupId;
                const minBid = round.minBid || group.defaultBidTerms?.minBid || 0;
                const maxBid = round.maxBid || group.defaultBidTerms?.maxBid || 0;
                const step = round.bidMultiple || group.defaultBidTerms?.bidMultiple || 1;

                // Notify Admins
                await notifyAdmins(
                    `Bidding Today — "${group.name}" 📅`,
                    `Bidding for "${group.name}" Month ${round.monthNumber} is scheduled today at 5:00 PM. Current terms: Min ₹${minBid}, Max ₹${maxBid}, Step ₹${step}. Update terms before 5 PM if needed.`,
                    "BIDDING_REMINDER",
                    io,
                    group._id
                );

                // Notify Members
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

/**
 * CRON 2: 12:00 PM IST 
 * Midday reminder (5 hours before open) for both admins and members.
 */
function scheduleTwelvePmReminder(io) {
    cron.schedule("0 12 * * *", async () => {
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) return;

            for (const round of rounds) {
                const group = round.groupId;
                const minBid = round.minBid || group.defaultBidTerms?.minBid || 0;
                const maxBid = round.maxBid || group.defaultBidTerms?.maxBid || 0;
                const step = round.bidMultiple || group.defaultBidTerms?.bidMultiple || 1;

                // Notify Admins
                await notifyAdmins(
                    `Bidding in 5 Hours — "${group.name}" ⏰`,
                    `Reminder: Bidding for "${group.name}" Month ${round.monthNumber} auto-opens at 5:00 PM. Terms set: Min ₹${minBid}, Max ₹${maxBid}, Step ₹${step}. You have until 4:59 PM to update them.`,
                    "BIDDING_REMINDER",
                    io,
                    group._id
                );

                // Notify Members
                await notifyGroupMembers(
                    group._id,
                    `Bidding in 5 Hours ⏰`,
                    `Reminder: Bidding for "${group.name}" Month ${round.monthNumber} opens today at 5:00 PM.`,
                    "BIDDING_REMINDER",
                    io
                );
            }
        } catch (err) {
            console.error("[CRON 12PM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}

/**
 * CRON 3: 4:00 PM IST
 * Final reminder (1 hour before open) for admins (last chance to update) and members.
 */
function scheduleFourPmReminder(io) {
    cron.schedule("0 16 * * *", async () => {
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) return;

            for (const round of rounds) {
                const group = round.groupId;
                const minBid = round.minBid || group.defaultBidTerms?.minBid || 0;
                const maxBid = round.maxBid || group.defaultBidTerms?.maxBid || 0;
                const step = round.bidMultiple || group.defaultBidTerms?.bidMultiple || 1;

                // Notify Admins
                await notifyAdmins(
                    `🚨 Bidding Opens in 1 Hour — "${group.name}"`,
                    `Final reminder: Bidding for "${group.name}" Month ${round.monthNumber} auto-opens at 5:00 PM with terms Min ₹${minBid}, Max ₹${maxBid}, Step ₹${step}. Last chance to update.`,
                    "BIDDING_REMINDER",
                    io,
                    group._id
                );

                // Notify Members
                await notifyGroupMembers(
                    group._id,
                    `🚨 Bidding Opens in 1 Hour!`,
                    `Final reminder: Bidding for "${group.name}" Month ${round.monthNumber} opens at 5:00 PM. Get ready!`,
                    "BIDDING_REMINDER",
                    io
                );
            }
        } catch (err) {
            console.error("[CRON 4PM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}

/**
 * CRON 4: 5:00 PM IST
 * Auto-opens bidding for all PENDING rounds scheduled today.
 */
function scheduleFivePmAutoOpen(io) {
    cron.schedule("0 17 * * *", async () => {
        try {
            const rounds = await getPendingRoundsScheduledToday();
            if (!rounds.length) return;

            const now = new Date();
            const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
            const nowIST = new Date(now.getTime() + IST_OFFSET_MS);

            // Set close time to 8:00 PM IST today
            const eightPmUTC = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 20, 0, 0));
            const endedAt = new Date(eightPmUTC.getTime() - IST_OFFSET_MS);

            for (const round of rounds) {
                const group = round.groupId;

                // Fallback to group default terms if round-specific terms are missing
                const minBid = round.minBid > 0 ? round.minBid : group.defaultBidTerms?.minBid;
                const maxBid = round.maxBid > 0 ? round.maxBid : group.defaultBidTerms?.maxBid;
                const bidMultiple = round.bidMultiple > 1 ? round.bidMultiple : group.defaultBidTerms?.bidMultiple || 1;

                // Validate terms before opening
                if (!minBid || !maxBid || minBid <= 0 || maxBid <= 0 || minBid >= maxBid) {
                    await notifyAdmins(
                        `⚠️ Bidding Could Not Open — "${group.name}"`,
                        `Bidding for "${group.name}" Month ${round.monthNumber} could not auto-open due to invalid bid terms. Please open manually.`,
                        "BIDDING_OPEN",
                        io,
                        group._id
                    );
                    continue;
                }

                // Open Bidding
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

                // Emit real-time update to active clients
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

/**
 * CRON 5: 8:00 PM IST
 * Auto-closes all OPEN bidding rounds and processes results.
 */
function scheduleEightPmAutoClose(io) {
    cron.schedule("0 20 * * *", async () => {
        try {
            const openRounds = await BiddingRound.find({ status: "OPEN" })
                // FIX: Added totalPoolAmount to population string
                .populate("groupId", "name totalMembers monthlyContribution totalPoolAmount members")
                .lean();

            for (const round of openRounds) {
                await autoCloseRound(round, io);
            }
        } catch (err) {
            console.error("[CRON 8PM] Error:", err.message);
        }
    }, { timezone: TIMEZONE });
}

/**
 * Core logic to close a bidding round, calculate the winner/dividends, and update records.
 */
async function autoCloseRound(round, io) {
    try {
        const group = round.groupId;
        const bids = await Bid.find({ biddingRoundId: round._id })
            .sort({ bidAmount: -1 })
            .populate("userId", "name")
            .lean();

        // Handle Case: No bids placed
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
            return;
        }

        const highestBidAmount = bids[0].bidAmount;
        const highestBidders = bids.filter(b => b.bidAmount === highestBidAmount);

        // Handle Case: Tie for highest bid
        if (highestBidders.length > 1) {
            await BiddingRound.findByIdAndUpdate(round._id, { $set: { status: "CLOSED" } });

            // FIX: Emit the exact same object structure as the manual HTTP response
            io.to(round._id.toString()).emit("biddingClosed", {
                success: true,
                tie: true,
                message: "Tie detected. Admin must select winner.",
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

            console.log(`[CRON 8PM] Tie detected for ${group.name} Month ${round.monthNumber} - Admin Notified`);
            return;
        }

        // Handle Case: Clear Winner
        const winnerBid = highestBidders[0];

        // FIX: Safely extract and cast numbers to prevent NaN errors
        const winningBidAmount = Number(winnerBid.bidAmount) || 0;
        const totalMembers = Number(group.totalMembers) || 1;
        const monthlyContribution = Number(group.monthlyContribution) || 0;

        // FIX: Fetch totalPoolAmount from the ROUND object, with a fallback
        const poolAmount = Number(round.totalPoolAmount) || (totalMembers * monthlyContribution);

        const dividendPerMember = Math.floor(winningBidAmount / totalMembers);
        const payablePerMember = monthlyContribution - dividendPerMember;
        const winnerReceivable = poolAmount - winningBidAmount - payablePerMember;

        // Transition round to PAYMENT_OPEN
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

        // Flag winner in group members array
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

        // Flag non-winners as PENDING for payment
        await Groups.updateOne(
            { _id: group._id },
            { $set: { "members.$[elem].currentPaymentStatus": "PENDING" } },
            { arrayFilters: [{ "elem.userId": { $ne: winnerBid.userId._id } }] }
        );

        // Emit real-time closing data
        io.to(round._id.toString()).emit("biddingClosed", {
            winnerUserId: winnerBid.userId._id,
            winnerName: winnerBid.userId.name,
            winningBidAmount,
            winnerReceivableAmount: winnerReceivable,
            dividendPerMember,
            payablePerMember
        });

        // Dispatch notifications
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

/**
 * Initializes all automated cron jobs.
 * Call this once during app startup after the DB connects.
 */
function initCronJobs(io) {
    scheduleNineAmReminder(io);
    scheduleTwelvePmReminder(io);
    scheduleFourPmReminder(io);
    scheduleFivePmAutoOpen(io);
    scheduleEightPmAutoClose(io);

    console.log("Cron jobs initialized — bidding automation active (IST timezone)");
}

module.exports = { initCronJobs };