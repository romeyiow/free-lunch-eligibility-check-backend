// controllers/authController.js
const colors = require('colors'); // Optional
const Admin = require('../models/AdminModel'); // Import the Admin model
const generateToken = require('../utils/generateToken'); // Import the token generator
// const asyncHandler = require('../middleware/asyncHandler'); // We'll add this later for cleaner async error handling

// controllers/authController.js
// ... (other imports) ...

// @desc    Authenticate admin & get token
// @route   POST /api/v1/auth/login
// @access  Public
const loginAdmin = async (req, res, next) => {
    const { email, password } = req.body;

    // Basic Validation: Check if email and password exist
    if (!email || !password) {
        res.status(400); // Bad Request
        return next(new Error('Please provide both email and password'));
        // Using return next(error) is better than just throwing error in async functions without asyncHandler
    }

    try {
        // Find admin by email - use select('+password') to explicitly include the password field
        // which we excluded by default in the AdminModel schema (select: false)
        const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');

        // Check if admin exists and if password matches
        if (admin && (await admin.matchPassword(password))) {
            // Password matches - generate token
            const token = generateToken(admin._id);

            // Send response with user info (excluding password) and token
            res.status(200).json({
                success: true,
                message: 'Login successful',
                token, // Include the JWT in the response
                admin: { // Send back some admin details (never the password)
                    _id: admin._id,
                    name: admin.name,
                    email: admin.email,
                },
            });
        } else {
            // Admin not found or password doesn't match
            res.status(401); // Unauthorized
            return next(new Error('Invalid email or password'));
        }
    } catch (error) {
        // Catch any unexpected errors during database query or password comparison
        console.error(`Login Error: ${error.message}`.red);
        return next(error); // Pass error to the global error handler
    }
};

// @desc    Get current logged-in admin profile
// @route   GET /api/v1/auth/me
// @access  Private (Requires JWT)
const getAdminProfile = (req, res, next) => {
    // The 'protect' middleware should have already attached the admin document to req.admin
    if (req.admin) {
        res.status(200).json({
            success: true,
            admin: req.admin // Send the admin data attached by the middleware
        });
    } else {
        // This case should technically not be reached if protect middleware works correctly
        res.status(404);
        return next(new Error('Admin profile not found'));
    }
};


// ... (keep testError function for now) ...
// Simulate an error for testing error handler
const testError = (req, res, next) => {
    console.log('Test error endpoint hit'.magenta);
    // Simulate an error occurring
    const err = new Error('This is a simulated test error!');
    res.status(400); // Set a specific status code before passing error
    next(err); // Pass the error to the errorHandler middleware
};


module.exports = {
    loginAdmin,
    getAdminProfile,
    testError, // Keep testError if needed
    // Add other functions here later: getAdminProfile, forgotPassword, resetPassword
};

