// routes/eligibilityRoutes.js
const express = require('express');
const { checkStudentEligibility } = require('../controllers/eligibilityController');
const { protectKitchen } = require('../middleware/authMiddleware'); // Import the API Key protection

const router = express.Router();

// GET /api/v1/eligibility/:studentIdNumber - Check student eligibility
router.get(
    '/:studentIdNumber',
    // protectKitchen, // Apply API Key protection middleware
    checkStudentEligibility
);

module.exports = router;