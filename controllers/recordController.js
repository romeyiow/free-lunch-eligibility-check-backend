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
    
    // --- THIS IS THE FIX ---
    // We only care about records where the student was actually eligible.
    query.status = { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] };
    // ----------------------
    
    // --- Program and Student Name Search ---
    if (req.query.program) {
        studentQuery.program = req.query.program.toUpperCase();
    }
    if (req.query.searchStudentName) {
        studentQuery.name = new RegExp(req.query.searchStudentName, 'i');
    }

    if (Object.keys(studentQuery).length > 0) {
        const matchingStudents = await Student.find(studentQuery).select('_id');
        const studentIds = matchingStudents.map(student => student._id);

        if (studentIds.length === 0) {
            return res.status(200).json({ success: true, count: 0, pagination: {}, data: [] });
        }
        query.student = { $in: studentIds };
    }

    // --- Sorting ---
    let sort = { 'student.name': 1, dateChecked: 1 }; // Sort by name, then date
    if (req.query.sortBy) {
        const order = req.query.order === 'asc' ? 1 : -1;
        sort = { [req.query.sortBy]: order };
    }

    // --- Pagination ---
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 8; // Default limit to 8 as per UI
    const startIndex = (page - 1) * limit;

    // --- Database Query ---
    // Note: We cannot easily paginate a GROUPed query. The pagination must be done on the frontend
    // after we have all the relevant sparse data for the month.
    // The query now fetches all relevant records for the month for the given program filter.
    
    const mealRecords = await MealRecord.find(query)
        .populate({
            path: 'student',
            select: 'name' // Only need name for display
        })
        .sort(sort);

    // --- Manual Grouping and Pagination ---
    const studentData = mealRecords.reduce((acc, record) => {
        const studentId = record.student?._id;
        if (!studentId) return acc;

        if (!acc[studentId]) {
            acc[studentId] = {
                _id: studentId,
                name: record.student.name,
                records: []
            };
        }
        acc[studentId].records.push(record);
        return acc;
    }, {});
    
    const allStudents = Object.values(studentData);
    const totalStudents = allStudents.length;

    // Paginate the list of students
    const paginatedStudents = allStudents.slice(startIndex, startIndex + limit);

    // Create the final data structure for the response
    const responseData = paginatedStudents.flatMap(student => student.records);
    
    const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalStudents / limit),
        limit,
        totalItems: totalStudents,
    };

    res.status(200).json({
        success: true,
        count: responseData.length,
        pagination,
        data: responseData,
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

    const studentsWithRecords = await MealRecord.find({
        dateChecked: { $gte: startDate, $lte: endDate }
    }).distinct('student');
    const studentsWithRecordsSet = new Set(studentsWithRecords.map(id => id.toString()));

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

    const recordsToInsert = studentsToMarkAsUnclaimed.map(student => ({
        student: student._id,
        studentIdNumber: student.studentIdNumber,
        programAtTimeOfRecord: student.program,
        yearLevelAtTimeOfRecord: student.yearLevel,
        dateChecked: startDate,
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
    generateUnclaimedRecords,
};