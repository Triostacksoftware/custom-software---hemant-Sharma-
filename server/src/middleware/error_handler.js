const express = require("express");

const errorHandler = async (err, req, res, next) => {
    //logging the full error (server-side only)
    console.error("Unhandled error:", err);


    // Duplicate key error (e.g. unique phoneNumber)
    if (err.code === 11000) {
        return res.status(409).json({
            error: "Duplicate value already exists"
        });
    }

    // Mongoose validation errors
    if (err.name === "ValidationError") {
        return res.status(400).json({
            error: err.message
        });
    }

    //JWT error
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            error: "Invalid token"
        });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            error: "Token expired"
        });
    }

    //default fallback
    return res.status(500).json({
        error: "Internal server error"
    });
};


module.exports = errorHandler;