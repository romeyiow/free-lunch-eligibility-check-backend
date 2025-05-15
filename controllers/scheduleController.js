// controllers/scheduleController.js
const Schedule = require('../models/ScheduleModel');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose'); // Needed for ObjectId validation (though not directly in getSchedules, good to have)

// --- Controller Functions ---

// addScheduleEntry function remains here (as previously defined)
const addScheduleEntry = asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        return next(new Error(errors.array().map(err => err.msg).join(', ')));
    }

    const { program, yearLevel, scheduleDays } = req.body;

    if (program.toUpperCase() === 'ACT' && parseInt(yearLevel, 10) > 2) {
        res.status(400);
        return next(new Error('ACT program schedule is only available for Year 1 and 2.'));
    }

    const createdEntries = [];
    const errorEntries = [];

    for (const daySchedule of scheduleDays) {
        try {
            const entry = await Schedule.findOneAndUpdate(
                {
                    program: program.toUpperCase(),
                    yearLevel: parseInt(yearLevel, 10),
                    dayOfWeek: daySchedule.dayOfWeek,
                },
                {
                    $set: {
                        isEligible: daySchedule.isEligible,
                        program: program.toUpperCase(),
                        yearLevel: parseInt(yearLevel, 10),
                    }
                },
                { new: true, upsert: true, runValidators: true }
            );
            createdEntries.push(entry);
        } catch (error) {
            if (error.code === 11000 || error.message.includes('duplicate key error')) {
                errorEntries.push({
                    daySchedule,
                    error: `A schedule entry for ${program} Year ${yearLevel} on ${daySchedule.dayOfWeek} might conflict or already processed.`,
                });
            } else {
                errorEntries.push({ daySchedule, error: error.message });
            }
            console.error(`Error processing schedule for ${daySchedule.dayOfWeek}: ${error.message}`);
        }
    }

    if (errorEntries.length > 0 && createdEntries.length === 0) {
        res.status(400);
        return next(new Error(`Failed to create/update schedule entries. Errors: ${JSON.stringify(errorEntries)}`));
    }

    res.status(201).json({
        success: true,
        message: `Schedule entries processed. ${createdEntries.length} successful, ${errorEntries.length} failed.`,
        data: createdEntries,
        errors: errorEntries.length > 0 ? errorEntries : undefined,
    });
});


// @desc    Get all schedule entries, or a structured weekly view if program & yearLevel are specified
// @route   GET /api/v1/schedules
// @access  Private (Admin Only)
const getSchedules = asyncHandler(async (req, res, next) => {
    let query = {};
    const specificProgram = req.query.program ? req.query.program.toUpperCase() : null;
    const specificYearLevelString = req.query.yearLevel; // Keep as string for parsing check
    let specificYearLevel = null;

    if (specificYearLevelString) {
        const parsedYear = parseInt(specificYearLevelString, 10);
        if (!isNaN(parsedYear)) {
            specificYearLevel = parsedYear;
        } else {
            // Optional: handle invalid yearLevel query param if needed, or let it be ignored
            // For now, we'll just proceed if it's not a valid number, meaning specificYearLevel remains null
        }
    }

    if (specificProgram) {
        query.program = specificProgram;
    }
    if (specificYearLevel !== null) { // Check against the parsed numeric value
        query.yearLevel = specificYearLevel;
    }

    // Optional: Allow filtering by a single dayOfWeek if program & yearLevel are NOT both specified
    if (!(specificProgram && specificYearLevel !== null) && req.query.dayOfWeek) {
        query.dayOfWeek = req.query.dayOfWeek;
    }

    // Always fetch sorted data to make processing easier if transforming
    const schedulesFromDB = await Schedule.find(query).sort({ dayOfWeek: 1 }); // Simpler sort if only one program/year

    // If a specific program AND yearLevel were requested, transform the data
    if (specificProgram && specificYearLevel !== null) {
        // Initialize the weekly schedule object with default values
        const DAYS_OF_WEEK_ORDERED = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weeklySchedule = {};
        const scheduleEntryIds = {};

        DAYS_OF_WEEK_ORDERED.forEach(day => {
            weeklySchedule[day] = 'Not Set'; // Default status
            scheduleEntryIds[day] = null;   // Default ID
        });

        schedulesFromDB.forEach(entry => {
            // This check is redundant if query object was built correctly, but good for safety
            if (entry.program === specificProgram && entry.yearLevel === specificYearLevel) {
                if (weeklySchedule.hasOwnProperty(entry.dayOfWeek)) {
                    weeklySchedule[entry.dayOfWeek] = entry.isEligible ? 'Eligible' : 'Ineligible';
                    scheduleEntryIds[entry.dayOfWeek] = entry._id.toString();
                }
            }
        });

        // If no entries were found specifically for this program/year (schedulesFromDB would be empty if query was specific)
        // The default "Not Set" values in weeklySchedule will be returned.
        // We can add a message if the schedulesFromDB array was empty for this specific query.
        let message = `Weekly schedule for ${specificProgram} Year ${specificYearLevel}.`;
        if (schedulesFromDB.filter(s => s.program === specificProgram && s.yearLevel === specificYearLevel).length === 0) {
            message = `No schedule entries found for ${specificProgram} Year ${specificYearLevel}. Defaulting to 'Not Set'.`;
        }


        return res.status(200).json({
            success: true,
            message: message,
            program: specificProgram,
            yearLevel: specificYearLevel,
            weeklySchedule: weeklySchedule,
            _idsPerDay: scheduleEntryIds
        });

    } else {
        // If not filtering by specific program AND year, return the flat list (original behavior)
        return res.status(200).json({
            success: true,
            count: schedulesFromDB.length,
            data: schedulesFromDB,
        });
    }
});


// --- Export Controller Functions ---
module.exports = {
    addScheduleEntry,
    getSchedules,
    // updateScheduleEntry and deleteScheduleEntry will be added next
};