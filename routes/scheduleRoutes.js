// routes/scheduleRoutes.js
const express = require('express');
// Update this line near the top
const { addScheduleEntry, getSchedules, updateScheduleEntry, deleteScheduleEntry } = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

const ALLOWED_PROGRAMS_FOR_SCHEDULE = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const router = express.Router();

// Validation rules for adding/updating schedule entries
const scheduleValidationRules = [
    body('program', 'Program is required').notEmpty().trim().toUpperCase()
        .isIn(ALLOWED_PROGRAMS_FOR_SCHEDULE).withMessage(`Program must be one of: ${ALLOWED_PROGRAMS_FOR_SCHEDULE.join(', ')}`),
    body('yearLevel', 'Year Level is required').notEmpty()
        .isInt({ min: 1, max: 4 }).withMessage('Year Level must be an integer between 1 and 4'),
    body('scheduleDays', 'Schedule days must be an array and is required').isArray({ min: 1 }),
    body('scheduleDays.*.dayOfWeek', 'Each schedule day must have a valid dayOfWeek').notEmpty().isIn(DAYS_OF_WEEK),
    body('scheduleDays.*.isEligible', 'Each schedule day must have an isEligible boolean value').isBoolean(),
];

const updateScheduleValidationRules = [
    body('isEligible', 'isEligible field must be a boolean and is required for update').exists().isBoolean(),
];

// --- Route Definitions ---

// POST /api/v1/schedules - Add new schedule entries
router.post(
    '/',
    protect,
    scheduleValidationRules,
    addScheduleEntry
);

// GET /api/v1/schedules - Get all schedule entries (with optional filters)
router.get(
    '/',
    protect,
    getSchedules
);

// PUT /api/v1/schedules/:id - Update a specific daily schedule entry
router.put(
    '/:id',
    protect,
    updateScheduleValidationRules, // Apply validation for the update payload
    updateScheduleEntry
);

// DELETE /api/v1/schedules/:id - Delete a specific daily schedule entry
router.delete(
    '/:id',
    protect,
    deleteScheduleEntry
);

module.exports = router;