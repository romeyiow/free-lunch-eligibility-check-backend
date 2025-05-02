// utils/generateToken.js
const jwt = require('jsonwebtoken');

/**
 * Generates a signed JSON Web Token (JWT).
 * @param {string} id - The user ID to include in the token payload. Usually mongoose document _id.
 * @returns {string} The generated JWT.
 * @throws {Error} If JWT_SECRET or JWT_EXPIRES_IN environment variables are missing.
 */
const generateToken = (id) => {
    // Check for required environment variables
    if (!process.env.JWT_SECRET) {
        console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.'.red.bold);
        throw new Error('Server configuration error: JWT secret missing.'); // Throw error to be caught by error handler
    }
    if (!process.env.JWT_EXPIRES_IN) {
        console.warn('WARN: JWT_EXPIRES_IN not set, using default of 30d.'.yellow);
    }

    // Sign the token
    return jwt.sign(
        { id }, // Payload: contains the user's unique ID
        process.env.JWT_SECRET, // Secret key from environment variables
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '30d', // Expiration time from env or default
        }
    );
};

module.exports = generateToken;