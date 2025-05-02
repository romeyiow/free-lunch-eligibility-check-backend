// middleware/errorMiddleware.js
const colors = require('colors'); // Optional for colored logging

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

// Export the middleware functions
module.exports = { notFound, errorHandler };