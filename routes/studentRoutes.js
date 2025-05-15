// routes/studentRoutes.js
const express = require('express');
// Import necessary controller functions
// Update this line near the top
// Update this line near the top
const { addStudent, getStudents, getStudentById, updateStudent, deleteStudent } = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

const ALLOWED_PROGRAMS = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];

const router = express.Router();

// --- Validation Chains ---

// Rules for POST 
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

// NEW: Rules for PATCH (optional fields, but validate if present)
const studentPatchValidationRules = [
    body('studentIdNumber', 'Student ID Number must be a non-empty string if provided').optional().notEmpty().trim(),
    body('name', 'Student Name must be a non-empty string if provided').optional().notEmpty().trim(),
    body('program', `Program must be one of: ${ALLOWED_PROGRAMS.join(', ')} if provided`).optional().trim().toUpperCase()
        .isIn(ALLOWED_PROGRAMS),
    body('yearLevel', 'Year Level must be an integer between 1 and 4 if provided').optional()
        .isInt({ min: 1, max: 4 }),
    body('section', 'Section must be a string if provided').optional({ nullable: true }).isString().trim().toUpperCase(), // Allow null to clear
    body('profilePictureUrl', 'Profile Picture URL must be a valid URL if provided').optional({ nullable: true, checkFalsy: true }).isURL().trim(), // Allow null/empty to clear
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


// PATCH /api/v1/students/:id - Update a student by ID
// Replace the existing router.put(...) block with this:

// PATCH /api/v1/students/:id - Partially update a student by ID
router.patch(
    '/:id',
    protect, // Ensure user is logged in (admin)
    studentPatchValidationRules, // Use the new optional validation rules
    updateStudent // We can still use the existing controller function name for now
);

// DELETE /api/v1/students/:id - Delete a student by ID
router.delete(
    '/:id',
    protect, // Ensure user is logged in (admin)
    deleteStudent // Call the deleteStudent controller function
);

// --- Export Router ---
module.exports = router;