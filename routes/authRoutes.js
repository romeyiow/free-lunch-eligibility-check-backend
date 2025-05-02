// routes/authRoutes.js
const express = require('express');
const { loginAdmin, testError } = require('../controllers/authController'); // Import controller functions

const router = express.Router(); // Create an Express router instance

// Define routes and link them to controller functions
router.post('/login', loginAdmin);
router.get('/testerror', testError); // Add route for testing error handling

// Add other auth routes here later (register, forgot password, etc.)

module.exports = router; // Export the router