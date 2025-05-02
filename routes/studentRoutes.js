// routes/studentRoutes.js
const express = require('express');
const { addStudent } = require('../controllers/studentController'); // Import controller function(s)
const { protect } = require('../middleware/authMiddleware'); // Import protect middleware
const { body } = require('express-validator'); // Import validation chain linker

// Define allowed programs based on your list (repeat here or import from a shared config)
const ALLOWED_PROGRAMS = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];

const router = express.Router();

// --- Validation Chains ---
// Define validation rules reusable for add/update routes
const studentValidationRules = [
    body('studentIdNumber', 'Student ID Number is required').notEmpty().trim(),
    body('name', 'Student Name is required').notEmpty().trim(),
    body('program', 'Program is required').notEmpty().trim().toUpperCase()
        .isIn(ALLOWED_PROGRAMS).withMessage(`Program must be one of: ${ALLOWED_PROGRAMS.join(', ')}`),
    body('yearLevel', 'Year Level is required').notEmpty()
        .isInt({ min: 1, max: 4 }).withMessage('Year Level must be an integer between 1 and 4'),
    body('section', 'Section must be a string if provided').optional().isString().trim().toUpperCase(),
    body('profilePictureUrl', 'Profile Picture URL must be a valid URL if provided').optional({ checkFalsy: true }).isURL().trim(),
    // Note: Complex validation (ACT program vs yearLevel) is handled in the controller for now
];


// --- Route Definitions ---

// Route for adding a new student
// Applies protect middleware first, then validation rules, then the controller
router.post(
    '/', // Corresponds to POST /api/v1/students
    protect, // Ensure user is logged in (admin)
    studentValidationRules, // Apply validation rules to the request body
    addStudent // Call the controller function if auth and validation pass
);

// Add other routes here later (GET /, GET /:id, PUT /:id, DELETE /:id)

// --- Export Router ---
module.exports = router;