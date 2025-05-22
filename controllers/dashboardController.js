// controllers/dashboardController.js
const MealRecord = require('../models/MealRecordModel');
const Schedule = require('../models/ScheduleModel'); // May need for more accurate "allotted" later
const Student = require('../models/StudentModel'); // May need for "allotted" or program/year info
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// --- Helper Functions for Date Range Calculation ---

/**
 * Calculates the start and end date for a given filter period.
 * @param {string} filterPeriod - 'daily', 'weekly', 'monthly', 'semestral'
 * @param {string} value - Specific value for the filter (e.g., 'YYYY-MM-DD', 'YYYY-Www', 'YYYY-MM', '1st', '2nd')
 * @returns {object} { startDate, endDate, error?: string }
 */
const getFilterDateRange = (filterPeriod, value) => {
    const now = new Date();
    let startDate, endDate;

    switch (filterPeriod.toLowerCase()) {
        case 'daily':
            // Value is expected to be 'YYYY-MM-DD' or defaults to today
            const targetDate = value ? new Date(value) : now;
            if (isNaN(targetDate.getTime())) return { error: 'Invalid date format for daily filter.' };
            startDate = new Date(targetDate.setHours(0, 0, 0, 0));
            endDate = new Date(targetDate.setHours(23, 59, 59, 999));
            break;

        case 'weekly':
            // Value is expected to be 'YYYY-Www' (e.g., '2024-W23') or defaults to current week
            // For simplicity, let's handle 'week1', 'week2', 'week3', 'week4' of a given month (default current)
            // More robust week calculation might be needed for ISO weeks across year boundaries.
            // Assuming 'value' can be like "YYYY-MM-Ww" e.g. "2024-05-W1" for 1st week of May 2024
            // Or a simpler "W1" for current month. Let's simplify for now.
            // For now, let's assume 'value' is the week number (1-4/5) of the current month, or a specific date within the week.
            // The Acceptance Criteria mentions "weeks of the current month" for the dropdown.
            // A more robust implementation would use a library like date-fns for week calculations.

            // Simplified: If value is a date 'YYYY-MM-DD', get the week containing that date.
            let weekRefDate = now;
            if (value && !isNaN(new Date(value).getTime())) { // If value is a valid date string
                weekRefDate = new Date(value);
            } else if (value && value.toLowerCase().startsWith('week')) { // e.g., "week1"
                // This part needs more specific logic based on how frontend sends "week1", "week2"
                // For now, we'll default to the week of the current date or a provided date.
                 return { error: 'Detailed weekly sub-filter (week1, week2) needs more specific date input or more complex logic.' };
            }

            const dayOfWeek = weekRefDate.getDay(); // 0 (Sun) - 6 (Sat)
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust if week starts Sunday or Monday
            startDate = new Date(weekRefDate.setDate(weekRefDate.getDate() + diffToMonday));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // Assuming Monday to Sunday week
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'monthly':
            // Value is 'YYYY-MM' or defaults to current month
            let year = now.getFullYear();
            let month = now.getMonth(); // 0-11
            if (value) { // Expect YYYY-MM
                const parts = value.split('-');
                if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
                    year = parseInt(parts[0]);
                    month = parseInt(parts[1]) - 1; // JS month is 0-indexed
                } else {
                    return { error: 'Invalid format for monthly filter. Use YYYY-MM.' };
                }
            }
            startDate = new Date(year, month, 1, 0, 0, 0, 0);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); // Day 0 of next month gives last day of current
            break;

        case 'semestral':
            // Value is '1st' or '2nd' (referring to '1st Sem', '2nd Sem')
            const currentYear = now.getFullYear();
            if (value === '1st') { // Sep (prev year) to Jan (current year) - simplified for now
                                   // AC: Sep (prev year) to Jan (current year)
                startDate = new Date(currentYear -1 , 8, 1); // September 1st of previous year (Month is 0-indexed)
                endDate = new Date(currentYear, 0, 31, 23, 59, 59, 999); // January 31st of current year
            } else if (value === '2nd') { // Feb to July of current year
                startDate = new Date(currentYear, 1, 1); // February 1st
                endDate = new Date(currentYear, 6, 31, 23, 59, 59, 999); // July 31st
            } else {
                return { error: "Invalid value for semestral filter. Use '1st' or '2nd'." };
            }
            break;

        default:
            return { error: 'Invalid filter period specified.' };
    }
    return { startDate, endDate };
};


// @desc    Get performance summary (allotted, claimed, unclaimed, ratios)
// @route   GET /api/v1/dashboard/summary
// @access  Private (Admin Only)
const getPerformanceSummary = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value } = req.query; // e.g., filterPeriod=daily, value=2024-05-10

    if (!filterPeriod) {
        res.status(400);
        return next(new Error("Filter period (e.g., 'daily', 'weekly', 'monthly', 'semestral') is required."));
    }

    const { startDate, endDate, error: dateError } = getFilterDateRange(filterPeriod, value);

    if (dateError) {
        res.status(400);
        return next(new Error(dateError));
    }

    // Define the match stage for the aggregation based on the date range
    const matchStage = {
        dateChecked: { $gte: startDate, $lte: endDate },
        status: { $ne: 'INELIGIBLE_STUDENT_NOT_FOUND' } // Exclude checks where student wasn't even found
    };

    const aggregationResult = await MealRecord.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null, // Group all matched documents together
                claimed: {
                    $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] }
                },
                // For "unclaimed", count records where student was found but not eligible per schedule
                unclaimed: {
                    $sum: { $cond: [{ $eq: ['$status', 'INELIGIBLE_NOT_SCHEDULED'] }, 1, 0] }
                },
                // For "allotted", count unique students who had any valid record in this period
                // This is a simplified definition.
                uniqueStudentsWithRecord: { $addToSet: '$student' } // Collect unique student ObjectIds
            }
        },
        {
            $project: {
                _id: 0,
                claimed: 1,
                unclaimed: 1,
                allotted: { $size: '$uniqueStudentsWithRecord' } // Count the unique students
            }
        }
    ]);

    let summary = {
        name: `${filterPeriod.charAt(0).toUpperCase() + filterPeriod.slice(1)} Report` + (value ? ` for ${value}` : ''),
        allotted: 0,
        claimed: 0,
        unclaimed: 0,
        claimedRatio: 0,
        unclaimedRatio: 0,
    };

    if (aggregationResult.length > 0) {
        const result = aggregationResult[0];
        summary.allotted = result.allotted || 0;
        summary.claimed = result.claimed || 0;
        summary.unclaimed = result.unclaimed || 0; // Based on INELIGIBLE_NOT_SCHEDULED

        if (summary.allotted > 0) {
            summary.claimedRatio = parseFloat(((summary.claimed / summary.allotted) * 100).toFixed(2));
            // Unclaimed ratio should be based on those who could have claimed but didn't, or were scheduled but ineligible.
            // For now, this 'unclaimed' is specific to 'INELIGIBLE_NOT_SCHEDULED'.
            // If allotted = unique students who had a record (claimed or not_scheduled_ineligible):
            summary.unclaimedRatio = parseFloat(((summary.unclaimed / summary.allotted) * 100).toFixed(2));
        }
    }

    res.status(200).json({
        success: true,
        filterDetails: { filterPeriod, value, startDate, endDate },
        data: summary
    });
});

// @desc    Get program/year breakdown (allotted, claimed, unclaimed, ratios)
// @route   GET /api/v1/dashboard/program-breakdown
// @access  Private (Admin Only)
const getProgramBreakdown = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value, groupBy } = req.query; // groupBy could be 'program' or 'programYear'

    if (!filterPeriod) {
        res.status(400);
        return next(new Error("Filter period (e.g., 'daily', 'weekly', 'monthly', 'semestral') is required."));
    }

    const { startDate, endDate, error: dateError } = getFilterDateRange(filterPeriod, value);

    if (dateError) {
        res.status(400);
        return next(new Error(dateError));
    }

    // Define the match stage for the aggregation based on the date range
    const matchStage = {
        dateChecked: { $gte: startDate, $lte: endDate },
        status: { $ne: 'INELIGIBLE_STUDENT_NOT_FOUND' }
    };

    // Define the grouping stage based on whether we group by program or program & year
    // The UI schema for "Claimed - Unclaimed per Course" implies grouping by Program.
    // The "Vertical Bar Graph" in System Design is less clear but might imply Program & Year.
    // Let's default to grouping by Program, and potentially allow 'programYear' via query param later if needed.

    let groupByIdFields = { program: '$programAtTimeOfRecord' }; // Default grouping
    let projectFields = {
        _id: 0,
        program: '$_id.program', // The program name from the group _id
        // yearLevel: '$_id.yearLevel' // If grouping by yearLevel as well
    };

    // Based on Acceptance Criteria "Claimed - Unclaimed per Course", it seems to be per Program.
    // If the "Vertical Bar Graph" needs per year, we might adjust or add another endpoint/param.
    // For now, let's stick to per Program.

    const aggregationPipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: groupByIdFields,
                claimed: {
                    $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] }
                },
                unclaimed: { // Students found but not eligible per schedule
                    $sum: { $cond: [{ $eq: ['$status', 'INELIGIBLE_NOT_SCHEDULED'] }, 1, 0] }
                },
                // Simplified "allotted": unique students who had any valid record for this program in this period
                uniqueStudentsWithRecord: { $addToSet: '$student' }
            }
        },
        {
            $project: {
                ...projectFields,
                allotted: { $size: '$uniqueStudentsWithRecord' },
                claimed: 1,
                unclaimed: 1,
                claimedRatio: {
                    $cond: [
                        { $eq: [{ $size: '$uniqueStudentsWithRecord' }, 0] }, // Avoid division by zero
                        0,
                        { $round: [{ $multiply: [{ $divide: ['$claimed', { $size: '$uniqueStudentsWithRecord' }] }, 100] }, 2] }
                    ]
                },
                unclaimedRatio: {
                    $cond: [
                        { $eq: [{ $size: '$uniqueStudentsWithRecord' }, 0] },
                        0,
                        { $round: [{ $multiply: [{ $divide: ['$unclaimed', { $size: '$uniqueStudentsWithRecord' }] }, 100] }, 2] }
                    ]
                }
            }
        },
        { $sort: { program: 1 } } // Sort by program name
    ];

    const programBreakdown = await MealRecord.aggregate(aggregationPipeline);

    res.status(200).json({
        success: true,
        filterDetails: { filterPeriod, value, startDate, endDate },
        data: programBreakdown
    });
});


module.exports = {
    getPerformanceSummary,
    getProgramBreakdown, 
};