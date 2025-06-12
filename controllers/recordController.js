// controllers/recordController.js
const MealRecord = require('../models/MealRecordModel');
const Student = require('../models/StudentModel'); // Needed for searching by student name
const Schedule = require('../models/ScheduleModel'); 
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// @desc    Get all meal records with filtering, sorting, pagination, and search by student name
// @route   GET /api/v1/meal-records
// @access  Private (Admin Only)
const getMealRecords = asyncHandler(async (req, res, next) => {
    let query = {}; // Mongoose query object for MealRecord

    // --- Filtering ---
    // Filter by specific student (using their MongoDB _id)
    if (req.query.studentId) {
        if (!mongoose.Types.ObjectId.isValid(req.query.studentId)) {
            res.status(400);
            return next(new Error('Invalid studentId format for filtering.'));
        }
        query.student = req.query.studentId;
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
        query.dateChecked = {
            $gte: new Date(req.query.startDate), // Greater than or equal to start date
            $lte: new Date(new Date(req.query.endDate).setHours(23, 59, 59, 999)) // Less than or equal to end of end date
        };
    } else if (req.query.startDate) {
        query.dateChecked = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
        query.dateChecked = { $lte: new Date(new Date(req.query.endDate).setHours(23, 59, 59, 999)) };
    }
    // Optional: Filter by month (e.g., YYYY-MM)
    if (req.query.month) { // Expects YYYY-MM format
        const [year, month] = req.query.month.split('-').map(Number);
        if (year && month && month >= 1 && month <= 12) {
            const startDate = new Date(year, month - 1, 1); // Month is 0-indexed
            const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month
            query.dateChecked = { $gte: startDate, $lte: endDate };
        }
    }

    // Filter by status
    if (req.query.status) {
        query.status = req.query.status.toUpperCase();
    }


    // --- Searching by Student Name ---
    // If search by student name, find student _ids first, then filter meal records
    if (req.query.searchStudentName) {
        const searchRegex = new RegExp(req.query.searchStudentName, 'i');
        const matchingStudents = await Student.find({ name: searchRegex }).select('_id');
        const studentIds = matchingStudents.map(student => student._id);

        if (studentIds.length > 0) {
            // If existing query.student, it means we are trying to filter by specific student AND name (unlikely UI)
            // For simplicity, student name search overrides specific studentId filter if both provided.
            // Or, if studentIds is empty from search, no records will match.
            query.student = { $in: studentIds };
        } else {
            // No students match the name search, so no meal records will be found.
            // Respond with empty list directly.
            return res.status(200).json({
                success: true,
                count: 0,
                pagination: { currentPage: 1, totalPages: 0, limit: 10, totalItems: 0 },
                data: []
            });
        }
    }

    // --- Sorting ---
    let sort = { dateChecked: -1 }; // Default sort by dateChecked descending (most recent first)
    if (req.query.sortBy) {
        const order = req.query.order === 'asc' ? 1 : -1; // Default to descending if not 'asc'
        sort = {}; // Override default if sortBy is provided
        sort[req.query.sortBy] = order;
        if(req.query.sortBy !== 'dateChecked') { // Ensure dateChecked is a secondary sort for consistency
            sort.dateChecked = -1;
        }
    }


    // --- Pagination ---
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    // --- Database Query ---
    const total = await MealRecord.countDocuments(query);
    const mealRecords = await MealRecord.find(query)
        .populate('student', 'name studentIdNumber program yearLevel section') // Populate student details
        .sort(sort)
        .skip(startIndex)
        .limit(limit);

    // --- Pagination Metadata ---
    const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
        totalItems: total,
    };

    // --- Response ---
    res.status(200).json({
        success: true,
        count: mealRecords.length,
        pagination,
        data: mealRecords,
    });
});

// @desc    Generate records for eligible students who did not claim a meal
// @route   POST /api/v1/meal-records/generate-unclaimed
// @access  Private (Admin Only)
const generateUnclaimedRecords = asyncHandler(async (req, res, next) => {
    const { date } = req.body;
    if (!date) {
        res.status(400);
        return next(new Error('A specific date (YYYY-MM-DD) is required in the request body.'));
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
        res.status(400);
        return next(new Error('Invalid date format. Please use YYYY-MM-DD.'));
    }

    // Set date range for the entire target day in UTC
    const startDate = new Date(targetDate);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setUTCHours(23, 59, 59, 999);
    
    const dayOfWeek = startDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(dayOfWeek)) {
        res.status(400);
        return next(new Error('Invalid day calculated from the provided date.'));
    }

    // 1. Find all students scheduled to be eligible on that day
    const eligibleSchedules = await Schedule.find({ dayOfWeek: dayOfWeek, isEligible: true }).select('program yearLevel');
    if (eligibleSchedules.length === 0) {
        return res.status(200).json({
            success: true,
            message: `No programs were scheduled as eligible on ${dayOfWeek}. No records generated.`,
            createdCount: 0,
        });
    }
    const eligibilityCriteria = eligibleSchedules.map(s => ({ program: s.program, yearLevel: s.yearLevel }));
    const allEligibleStudents = await Student.find({ $or: eligibilityCriteria }).select('_id studentIdNumber program yearLevel');

    // 2. Find all students who already have a meal record (claimed or otherwise) on that day
    const studentsWithRecords = await MealRecord.find({
        dateChecked: { $gte: startDate, $lte: endDate }
    }).distinct('student');
    const studentsWithRecordsSet = new Set(studentsWithRecords.map(id => id.toString()));

    // 3. Determine which eligible students do NOT have a record
    const studentsToMarkAsUnclaimed = allEligibleStudents.filter(student =>
        !studentsWithRecordsSet.has(student._id.toString())
    );

    if (studentsToMarkAsUnclaimed.length === 0) {
        return res.status(200).json({
            success: true,
            message: 'All eligible students for the specified date have been accounted for. No new records generated.',
            createdCount: 0,
        });
    }

    // 4. Create "ELIGIBLE_BUT_NOT_CLAIMED" records for them
    const recordsToInsert = studentsToMarkAsUnclaimed.map(student => ({
        student: student._id,
        studentIdNumber: student.studentIdNumber,
        programAtTimeOfRecord: student.program,
        yearLevelAtTimeOfRecord: student.yearLevel,
        dateChecked: startDate, // Set to the start of the day for consistency
        status: 'ELIGIBLE_BUT_NOT_CLAIMED',
    }));

    const result = await MealRecord.insertMany(recordsToInsert);

    res.status(201).json({
        success: true,
        message: `Successfully generated ${result.length} 'unclaimed' meal records for ${date}.`,
        createdCount: result.length,
    });
});

module.exports = {
    getMealRecords,
    generateUnclaimedRecords, // <-- Export the new function
};