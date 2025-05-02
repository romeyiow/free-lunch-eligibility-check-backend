// routes/authRoutes.js
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { loginAdmin, getAdminProfile, testError } = require('../controllers/authController');
const router = express.Router(); // Create an Express router instance

// Define routes and link them to controller functions
router.post('/login', loginAdmin);
router.get('/me', protect, getAdminProfile); // Apply protect middleware here!
router.get('/testerror', testError); // Add route for testing error handling

// Add other auth routes here later (register, forgot password, etc.)

module.exports = router; // Export the router