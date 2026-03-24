const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Only one ad should be active at a time.
// Admin creates/updates ads from the admin panel.
// The member dashboard fetches the single active ad for the marquee.
const adSchema = new Schema({
    adText: {
        type: String,
        required: true,
        trim: true
    },
    adLink: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Ad", adSchema);