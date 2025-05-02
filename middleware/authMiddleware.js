const jwt = require('jsonwebtoken');
const Admin = require('../models/AdminModel'); // Need Admin model to find user by ID from token
// const asyncHandler = require('./asyncHandler'); // Optional: For cleaner async error handling

// middleware/authMiddleware.js
// ... (imports) ...

/**
 * Protects routes by verifying JWT token.
 * Attaches the authenticated admin document to req.admin if successful.
 */
const protect = async (req, res, next) => {
    let token;

    // Check for Authorization header and ensure it starts with 'Bearer'
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Extract token from header (Bearer TOKEN_STRING)
            token = req.headers.authorization.split(' ')[1];

            // Verify the token using the JWT_SECRET
            if (!process.env.JWT_SECRET) {
                throw new Error('Server configuration error: JWT secret missing.');
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Find the admin user associated with the token's ID
            // Exclude the password field from the result
            req.admin = await Admin.findById(decoded.id).select('-password');

            if (!req.admin) {
                // If user associated with token no longer exists
                res.status(401);
                return next(new Error('Not authorized, user not found'));
            }

            next(); // Token is valid, user found, proceed to the next middleware/route handler

        } catch (error) {
            console.error(`Token Verification Error: ${error.message}`.red);
            res.status(401); // Unauthorized
            // Handle specific errors like token expiration
            if (error.name === 'JsonWebTokenError') {
                return next(new Error('Not authorized, token failed verification'));
            } else if (error.name === 'TokenExpiredError') {
                return next(new Error('Not authorized, token expired'));
            }
            return next(new Error('Not authorized, token error'));
        }
    }

    // If no token is found in the header
    if (!token) {
        res.status(401); // Unauthorized
        return next(new Error('Not authorized, no token provided'));
    }
};


// ... (keep notFound and errorHandler exports) ...
/**
 * Handles requests that don't match any defined routes (404 Not Found).
 * Creates an Error object and passes it to the next middleware (errorHandler).
 */
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404); // Set status code to 404
    next(error); // Pass the error along
};

/**
 * Generic error handler middleware.
 * Catches errors passed via next(error) or thrown synchronously.
 * Sends a consistent JSON error response.
 * Hides stack trace in production environments.
 */
const errorHandler = (err, req, res, next) => {
    // Determine the status code: use the status code set on the response if it's not 200, otherwise default to 500 (Internal Server Error)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode); // Set the determined status code

    // Log the error to the console (especially useful in development)
    // Use colors for better visibility if installed
    console.error(`ERROR: ${err.message}`.red);
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack.grey); // Log stack trace only in development
    }

    // Send JSON response
    res.json({
        success: false, // Indicate failure
        error: {
            message: err.message,
            // Conditionally include stack trace in response ONLY in development
            // (Never expose stack traces in production responses for security reasons)
            stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        },
    });
};
module.exports = {
    protect,
    notFound,
    errorHandler
};