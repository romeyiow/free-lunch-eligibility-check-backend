const Schedule = require('../models/ScheduleModel');
const Program = require('../models/ProgramModel');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Helper function for program validation
const validateProgramExists = async (programName) => {
    const program = await Program.findOne({ name: programName.toUpperCase() });
    if (!program) {
        throw new Error(`Program '${programName.toUpperCase()}' does not exist in the database.`);
    }
    return true;
};

const addScheduleEntry = asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        return next(new Error(errors.array().map(err => err.msg).join(', ')));
    }

    const { program, yearLevel, scheduleDays } = req.body;
    await validateProgramExists(program);

    if (program.toUpperCase() === 'ACT' && parseInt(yearLevel, 10) > 2) {
        res.status(400);
        return next(new Error('ACT program schedule is only available for Year 1 and 2.'));
    }

    const createdEntries = [];
    const errorEntries = [];

    for (const daySchedule of scheduleDays) {
        try {
            const entry = await Schedule.findOneAndUpdate(
                { program: program.toUpperCase(), yearLevel: parseInt(yearLevel, 10), dayOfWeek: daySchedule.dayOfWeek },
                { $set: { isEligible: daySchedule.isEligible, program: program.toUpperCase(), yearLevel: parseInt(yearLevel, 10) } },
                { new: true, upsert: true, runValidators: true }
            );
            createdEntries.push(entry);
        } catch (error) {
            errorEntries.push({ daySchedule, error: error.message });
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

const getSchedules = asyncHandler(async (req, res, next) => {
    let query = {};
    const specificProgram = req.query.program ? req.query.program.toUpperCase() : null;
    
    if (specificProgram) {
        query.program = specificProgram;
    }

    // Fetch and sort by year level first, then program. This handles your sorting requirement.
    const schedulesFromDB = await Schedule.find(query).sort({ yearLevel: 1, program: 1, dayOfWeek: 1 });

    res.status(200).json({
        success: true,
        count: schedulesFromDB.length,
        data: schedulesFromDB,
    });
});

const updateScheduleEntry = asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        return next(new Error(errors.array().map(err => err.msg).join(', ')));
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error(`Invalid schedule entry ID format: ${req.params.id}`));
    }
    const { isEligible } = req.body;
    const scheduleEntry = await Schedule.findByIdAndUpdate(
        req.params.id,
        { isEligible: isEligible },
        { new: true, runValidators: true }
    );
    if (!scheduleEntry) {
        res.status(404);
        return next(new Error(`Schedule entry not found with ID: ${req.params.id}`));
    }
    res.status(200).json({
        success: true,
        message: 'Schedule entry updated successfully',
        data: scheduleEntry,
    });
});

const deleteScheduleEntry = asyncHandler(async (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error(`Invalid schedule entry ID format: ${req.params.id}`));
    }
    const scheduleEntry = await Schedule.findById(req.params.id);
    if (!scheduleEntry) {
        res.status(404);
        return next(new Error(`Schedule entry not found with ID: ${req.params.id}`));
    }
    await scheduleEntry.deleteOne();
    res.status(200).json({
        success: true,
        message: `Schedule entry for ${scheduleEntry.program} Year ${scheduleEntry.yearLevel} on ${scheduleEntry.dayOfWeek} deleted successfully.`,
        data: {},
    });
});

module.exports = {
    addScheduleEntry,
    getSchedules,
    updateScheduleEntry,
    deleteScheduleEntry,
};