// routes/dashboardRoutes.js
const express = require('express');
const { getPerformanceSummary, getProgramBreakdown } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware'); // Admin protection

const router = express.Router();

// GET /api/v1/dashboard/summary - Get performance summary report
router.get(
    '/summary',
    protect, // Ensure only logged-in admins can access
    getPerformanceSummary
);

// GET /api/v1/dashboard/program-breakdown - Get data for program/year bar charts
router.get(
    '/program-breakdown',
    protect, // Ensure only logged-in admins can access
    getProgramBreakdown
);
module.exports = router;