// controllers/eligibilityController.js
const Student = require('../models/StudentModel');
const Schedule = require('../models/ScheduleModel');
const MealRecord = require('../models/MealRecordModel');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose'); // For ObjectId validation if needed elsewhere

// Helper function to get the current day of the week as a string (e.g., "Monday")
const getCurrentDayOfWeek = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    // new Date().getDay() returns 0 for Sunday, 1 for Monday, etc.
    // We need to map this to our schema's day strings
    return days[new Date().getDay()];
};

// @desc    Check student eligibility, record the check, and return student info + status
// @route   GET /api/v1/eligibility/:studentIdNumber
// @access  Protected by API Key (Kitchen Staff)
const checkStudentEligibility = asyncHandler(async (req, res, next) => {
    const { studentIdNumber } = req.params;

    if (!studentIdNumber || studentIdNumber.trim() === '') {
        res.status(400);
        return next(new Error('Student ID Number is required.'));
    }

    let student;
    let isEligibleToday = false;
    let mealRecordStatus;
    let studentDetailsForRecord = { // Store details for denormalization in MealRecord
        studentIdNumber: studentIdNumber.trim(),
        programAtTimeOfRecord: 'UNKNOWN',
        yearLevelAtTimeOfRecord: 0,
    };

    // 1. Find the student by studentIdNumber
    student = await Student.findOne({ studentIdNumber: studentIdNumber.trim() });

    if (!student) {
        mealRecordStatus = 'INELIGIBLE_STUDENT_NOT_FOUND';
        // Create MealRecord even if student not found, for tracking failed attempts
        await MealRecord.create({
            student: null, // No student document to reference
            studentIdNumber: studentDetailsForRecord.studentIdNumber,
            programAtTimeOfRecord: studentDetailsForRecord.programAtTimeOfRecord,
            yearLevelAtTimeOfRecord: studentDetailsForRecord.yearLevelAtTimeOfRecord,
            dateChecked: new Date(),
            status: mealRecordStatus,
        });

        res.status(404); // Not Found
        // For the kitchen output page, still send a structured response indicating not found
        return res.json({
            success: false, // Indicate failure clearly
            message: `Student with ID ${studentIdNumber} not found.`,
            studentInfo: { // Provide minimal info for the output display
                studentIdNumber: studentIdNumber.trim(),
                name: "Student Not Found",
                program: "N/A",
                year: "N/A",
                section: "N/A",
                profilePictureUrl: "/images/default-avatar.png", // Default image
            },
            eligibilityStatus: false,
            reason: "Student ID not found in masterlist."
        });
    }

    // If student found, update details for denormalization
    studentDetailsForRecord.programAtTimeOfRecord = student.program;
    studentDetailsForRecord.yearLevelAtTimeOfRecord = student.yearLevel;

    // 2. Determine current day and check schedule
    const currentDay = getCurrentDayOfWeek();
    const scheduleEntry = await Schedule.findOne({
        program: student.program,
        yearLevel: student.yearLevel,
        dayOfWeek: currentDay,
    });

    if (scheduleEntry && scheduleEntry.isEligible) {
        isEligibleToday = true;
        mealRecordStatus = 'CLAIMED'; // Assume eligible means claimed for now
    } else {
        isEligibleToday = false;
        mealRecordStatus = 'INELIGIBLE_NOT_SCHEDULED';
    }

    // 3. Create MealRecord
    await MealRecord.create({
        student: student._id,
        studentIdNumber: studentDetailsForRecord.studentIdNumber,
        programAtTimeOfRecord: studentDetailsForRecord.programAtTimeOfRecord,
        yearLevelAtTimeOfRecord: studentDetailsForRecord.yearLevelAtTimeOfRecord,
        dateChecked: new Date(),
        status: mealRecordStatus,
    });

    // 4. Prepare and send response for Kitchen Staff Output Page
    res.status(200).json({
        success: true, // Indicates the check was processed successfully
        studentInfo: {
            studentIdNumber: student.studentIdNumber,
            name: student.name,
            program: student.program,
            year: student.yearLevel, // Consistent naming
            section: student.section || "N/A",
            profilePictureUrl: student.profilePictureUrl,
        },
        eligibilityStatus: isEligibleToday,
        reason: isEligibleToday ? "Eligible for meal." : `Not scheduled for eligibility on ${currentDay}.`,
    });
});

module.exports = {
    checkStudentEligibility,
};