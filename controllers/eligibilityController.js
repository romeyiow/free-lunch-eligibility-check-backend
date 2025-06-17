const Student = require('../models/StudentModel');
const Schedule = require('../models/ScheduleModel');
const MealRecord = require('../models/MealRecordModel');
const asyncHandler = require('express-async-handler');
const firebaseAdmin = require('../config/firebaseAdmin');

const getCurrentDayOfWeek = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getUTCDay()];
};

const checkStudentEligibility = asyncHandler(async (req, res, next) => {
    const { studentIdNumber } = req.params;

    if (!studentIdNumber || studentIdNumber.trim() === '') {
        res.status(400);
        return next(new Error('Student ID Number is required.'));
    }

    const student = await Student.findOne({ studentIdNumber: studentIdNumber.trim() });

    if (!student) {
        await MealRecord.create({
            student: null,
            studentIdNumber: studentIdNumber.trim(),
            programAtTimeOfRecord: 'UNKNOWN',
            yearLevelAtTimeOfRecord: 0,
            dateChecked: new Date(),
            status: 'INELIGIBLE_STUDENT_NOT_FOUND',
        });
        return res.status(404).json({
            success: false,
            reason: "Student ID not found in masterlist."
        });
    }
    let profilePictureUrl = '/person-placeholder.jpg'; // Default placeholder
    try {
        // Use Firebase Admin to look up the user by their email from the student document
        const userRecord = await firebaseAdmin.auth().getUserByEmail(student.email);
        if (userRecord && userRecord.photoURL) {
            // If user exists and has a photo, use the high-resolution version
            profilePictureUrl = userRecord.photoURL.replace('=s96-c', '=s256-c');
        }
    } catch (error) {
        // This error is expected if the student email doesn't exist as a Firebase user.
        // We can safely ignore it and use the default placeholder.
        if (error.code !== 'auth/user-not-found') {
            console.warn(`Firebase lookup warning for ${student.email}: ${error.code}`);
        }
    } const currentDay = getCurrentDayOfWeek();
    const scheduleEntry = await Schedule.findOne({
        program: student.program,
        yearLevel: student.yearLevel,
        dayOfWeek: currentDay,
    });

    const isEligibleToday = !!(scheduleEntry && scheduleEntry.isEligible);
    const mealRecordStatus = isEligibleToday ? 'CLAIMED' : 'INELIGIBLE_NOT_SCHEDULED';

    await MealRecord.create({
        student: student._id,
        studentIdNumber: student.studentIdNumber,
        programAtTimeOfRecord: student.program,
        yearLevelAtTimeOfRecord: student.yearLevel,
        dateChecked: new Date(),
        status: mealRecordStatus,
    });

    res.status(200).json({
        success: true,
        studentInfo: {
            studentIdNumber: student.studentIdNumber,
            name: student.name,
            program: student.program,
            year: student.yearLevel,
            section: student.section || "N/A",
            profilePictureUrl: profilePictureUrl, 
        },
        eligibilityStatus: isEligibleToday,
        reason: isEligibleToday ? "Eligible for meal." : `Not scheduled for eligibility on ${currentDay}.`,
    });
});

module.exports = {
    checkStudentEligibility,
};