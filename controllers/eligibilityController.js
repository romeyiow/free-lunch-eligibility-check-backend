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
            eligibilityStatus: 'STUDENT_NOT_FOUND',
            reason: "Student ID not found in masterlist."
        });
    }

    // --- NEW LOGIC STARTS HERE ---
    
    // Define the start and end of the current day in UTC
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Check if the student has already claimed a meal today
    const existingRecord = await MealRecord.findOne({
        student: student._id,
        dateChecked: { $gte: todayStart, $lte: todayEnd },
        status: 'CLAIMED'
    });

    let profilePictureUrl = '/person-placeholder.jpg';
    try {
        const userRecord = await firebaseAdmin.auth().getUserByEmail(student.email);
        if (userRecord && userRecord.photoURL) {
            profilePictureUrl = userRecord.photoURL.replace('=s96-c', '=s256-c');
        }
    } catch (error) {
        if (error.code !== 'auth/user-not-found') {
            console.warn(`Firebase lookup warning for ${student.email}: ${error.code}`);
        }
    }
    
    const studentInfoPayload = {
        studentIdNumber: student.studentIdNumber,
        name: student.name,
        program: student.program,
        year: student.yearLevel,
        section: student.section || "N/A",
        profilePictureUrl: profilePictureUrl,
    };

    if (existingRecord) {
        return res.status(200).json({
            success: true,
            studentInfo: studentInfoPayload,
            eligibilityStatus: 'ALREADY_CLAIMED',
            reason: "Meal has already been claimed today.",
        });
    }
    
    // --- END OF NEW LOGIC ---

    const currentDay = getCurrentDayOfWeek();
    const scheduleEntry = await Schedule.findOne({
        program: student.program,
        yearLevel: student.yearLevel,
        dayOfWeek: currentDay,
    });

    const isEligibleToday = !!(scheduleEntry && scheduleEntry.isEligible);

    if (isEligibleToday) {
        // If eligible, create the 'CLAIMED' record now
        await MealRecord.create({
            student: student._id,
            studentIdNumber: student.studentIdNumber,
            programAtTimeOfRecord: student.program,
            yearLevelAtTimeOfRecord: student.yearLevel,
            dateChecked: new Date(),
            status: 'CLAIMED',
        });
        res.status(200).json({
            success: true,
            studentInfo: studentInfoPayload,
            eligibilityStatus: 'ELIGIBLE',
            reason: "Eligible for meal.",
        });
    } else {
        // If not eligible, create an 'INELIGIBLE' record
        await MealRecord.create({
            student: student._id,
            studentIdNumber: student.studentIdNumber,
            programAtTimeOfRecord: student.program,
            yearLevelAtTimeOfRecord: student.yearLevel,
            dateChecked: new Date(),
            status: 'INELIGIBLE_NOT_SCHEDULED',
        });
        res.status(200).json({
            success: true,
            studentInfo: studentInfoPayload,
            eligibilityStatus: 'NOT_SCHEDULED',
            reason: `Not scheduled for eligibility on ${currentDay}.`,
        });
    }
});

module.exports = {
    checkStudentEligibility,
};