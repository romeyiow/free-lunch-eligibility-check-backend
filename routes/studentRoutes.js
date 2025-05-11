// routes/studentRoutes.js
const express = require('express');
// Import necessary controller functions
const { addStudent, getStudents, getStudentById } = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

const ALLOWED_PROGRAMS = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];

const router = express.Router();

// --- Validation Chains ---
const studentValidationRules = [
    body('studentIdNumber', 'Student ID Number is required').notEmpty().trim(),
    body('name', 'Student Name is required').notEmpty().trim(),
    body('program', 'Program is required').notEmpty().trim().toUpperCase()
        .isIn(ALLOWED_PROGRAMS).withMessage(`Program must be one of: ${ALLOWED_PROGRAMS.join(', ')}`),
    body('yearLevel', 'Year Level is required').notEmpty()
        .isInt({ min: 1, max: 4 }).withMessage('Year Level must be an integer between 1 and 4'),
    body('section', 'Section must be a string if provided').optional().isString().trim().toUpperCase(),
    body('profilePictureUrl', 'Profile Picture URL must be a valid URL if provided').optional({ checkFalsy: true }).isURL().trim(),
];

// --- Route Definitions ---

// POST /api/v1/students - Add a new student
router.post(
    '/',
    protect,
    studentValidationRules,
    addStudent
);

// GET /api/v1/students - Get all students with filtering/pagination/etc.
router.get(
    '/',
    protect, // Ensure only logged-in admins can access
    getStudents // Call the getStudents controller function
);

// GET /api/v1/students/:id - Get a single student by ID
router.get(
    '/:id', // Uses a URL parameter ':id'
    protect, // Ensure only logged-in admins can access
    getStudentById // Call the getStudentById controller function
);

// --- Export Router ---
module.exports = router;