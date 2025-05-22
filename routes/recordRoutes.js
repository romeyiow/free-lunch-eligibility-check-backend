// routes/recordRoutes.js
const express = require('express');
const { getMealRecords } = require('../controllers/recordController');
const { protect } = require('../middleware/authMiddleware'); // Admin protection

const router = express.Router();

// GET /api/v1/meal-records - Get all meal records with filtering, pagination, etc.
router.get(
    '/',
    protect, // Ensure only logged-in admins can access
    getMealRecords
);

module.exports = router;