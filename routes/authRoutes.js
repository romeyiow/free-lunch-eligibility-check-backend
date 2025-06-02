// routes/authRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
// Make sure to destructure the new controller functions
const {
    loginAdmin,
    getAdminProfile,
    logoutAdmin,
    requestPasswordReset,
    resetPasswordWithCode // Add the new controller function here
} = require('../controllers/authController');
const router = express.Router();

// Define routes and link them to controller functions
router.post('/login', loginAdmin);
router.get('/me', protect, getAdminProfile);
router.post('/logout', protect, logoutAdmin);

// Password Reset Routes
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPasswordWithCode); // NEW ROUTE for resetting password

module.exports = router;