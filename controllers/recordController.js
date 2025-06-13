const MealRecord = require('../models/MealRecordModel');
const Student = require('../models/StudentModel');
const Schedule = require('../models/ScheduleModel');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

const getMealRecords = asyncHandler(async (req, res, next) => {
    let query = {};
    let studentQuery = {}; // Separate query for the Student model

    // --- Filtering ---
    if (req.query.month) {
        const [year, month] = req.query.month.split('-').map(Number);
        if (year && month) {
            const startDate = new Date(Date.UTC(year, month - 1, 1));
            const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
            query.dateChecked = { $gte: startDate, $lte: endDate };
        }
    }
    if (req.query.status) {
        query.status = req.query.status.toUpperCase();
    }
    
    // --- Program and Student Name Search ---
    // These filters apply to the Student collection, not the MealRecord directly
    if (req.query.program) {
        studentQuery.program = req.query.program.toUpperCase();
    }
    if (req.query.searchStudentName) {
        studentQuery.name = new RegExp(req.query.searchStudentName, 'i');
    }

    // If there are any student-specific filters, we need to find those students first
    if (Object.keys(studentQuery).length > 0) {
        const matchingStudents = await Student.find(studentQuery).select('_id');
        const studentIds = matchingStudents.map(student => student._id);

        if (studentIds.length === 0) {
            // No students match, so no records will be found.
            return res.status(200).json({ success: true, count: 0, pagination: {}, data: [] });
        }
        query.student = { $in: studentIds };
    }

    // --- Sorting ---
    let sort = { dateChecked: -1, 'student.name': 1 }; // Default sort
    if (req.query.sortBy) {
        const order = req.query.order === 'asc' ? 1 : -1;
        sort = { [req.query.sortBy]: order };
    }

    // --- Pagination ---
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    // --- Database Query ---
    const total = await MealRecord.countDocuments(query);
    const mealRecords = await MealRecord.find(query)
        .populate({
            path: 'student',
            select: 'name studentIdNumber program yearLevel section'
        })
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