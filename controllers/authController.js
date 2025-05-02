// controllers/authController.js
const colors = require('colors'); // Optional

// @desc    Placeholder login endpoint (will be implemented later)
// @route   POST /api/v1/auth/login
// @access  Public
const loginAdmin = (req, res, next) => {
    console.log('Login endpoint hit'.blue);
    // Simulate finding user and checking password later
    res.status(200).json({
        success: true,
        message: 'Placeholder login successful - Implement actual logic!',
    });
};

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
    testError, // Export the test error function
};