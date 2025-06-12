const express = require('express');
const { getPrograms, addProgram, updateProgram, deleteProgram } = require('../controllers/programController');
const { protect } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

const router = express.Router();

// Validation middleware for adding a program
const addProgramValidationRules = [
    body('name', 'Program name/acronym is required').notEmpty().isString().trim(),
    body('description', 'Program description is required').notEmpty().isString().trim(),
];

// --- Route Definitions ---

// GET all programs (publicly accessible for dropdowns)
// POST a new program (admin only)
router.route('/')
    .get(getPrograms)
    .post(protect, addProgramValidationRules, addProgram);

// Update a specific program (admin only)
// Delete a specific program (admin only)
router.route('/:id')
    .put(protect, updateProgram)
    .delete(protect, deleteProgram);

module.exports = router;