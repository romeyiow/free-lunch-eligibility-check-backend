const express = require('express');
const { addScheduleEntry, getSchedules, updateScheduleEntry, deleteScheduleEntry } = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const router = express.Router();

const scheduleValidationRules = [
    body('program', 'Program is required').notEmpty().trim().toUpperCase(),
    body('yearLevel', 'Year Level is required').notEmpty().isInt({ min: 1, max: 4 }).withMessage('Year Level must be an integer between 1 and 4'),
    body('scheduleDays', 'Schedule days must be an array and is required').isArray({ min: 1 }),
    body('scheduleDays.*.dayOfWeek', 'Each schedule day must have a valid dayOfWeek').notEmpty().isIn(DAYS_OF_WEEK),
    body('scheduleDays.*.isEligible', 'Each schedule day must have an isEligible boolean value').isBoolean(),
];

const updateScheduleValidationRules = [
    body('isEligible', 'isEligible field must be a boolean and is required for update').exists().isBoolean(),
];

router.post('/', protect, scheduleValidationRules, addScheduleEntry);
router.get('/', protect, getSchedules);
router.put('/:id', protect, updateScheduleValidationRules, updateScheduleEntry);
router.delete('/:id', protect, deleteScheduleEntry);

module.exports = router;