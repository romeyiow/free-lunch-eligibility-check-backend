// controllers/dashboardController.js
const MealRecord = require('../models/MealRecordModel');
const Schedule = require('../models/ScheduleModel'); // Keep if used by other functions
const Student = require('../models/StudentModel'); // Keep if used by other functions
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose'); // Keep if used by other functions

const getDaysInWeek = (refDate) => { // refDate is any date within the target week
    const date = new Date(refDate);
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date.setDate(date.getDate() + diffToMonday));
    const days = [];
    for (let i = 0; i < 6; i++) { // Monday to Saturday
        const currentDay = new Date(monday);
        currentDay.setDate(monday.getDate() + i);
        days.push({
            name: currentDay.toLocaleDateString('en-US', { weekday: 'long' }), // e.g., "Monday"
            date: new Date(currentDay.setHours(0, 0, 0, 0)) // YYYY-MM-DD for API value
        });
    }
    return days;
};

const getWeeksInMonth = (year, monthIndex) => { // monthIndex is 0-11
    const weeks = [];
    let date = new Date(year, monthIndex, 1);
    let weekCounter = 1;
    while (date.getMonth() === monthIndex) {
        const weekStart = new Date(date);
        const dayOfWeek = weekStart.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        weekStart.setDate(weekStart.getDate() + diffToMonday);
        weekStart.setHours(0, 0, 0, 0);

        // Ensure the week start is within the current month or the week has days in the current month
        if (weekStart.getMonth() > monthIndex && weekStart.getFullYear() >= year && weekStart.getDate() > 7) {
            // if Monday is in next month and it's not the first few days of the month
            break;
        }

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // Saturday or Sunday depending on week structure
        weekEnd.setHours(23, 59, 59, 999);

        weeks.push({
            name: `Week ${weekCounter}`,
            startDate: new Date(weekStart), // For API value (or just pass weekStart as YYYY-MM-DD)
            endDate: new Date(weekEnd)    // For API value
        });
        weekCounter++;
        date.setDate(weekStart.getDate() + 7); // Move to approx next week
    }
    return weeks.slice(0, 4); // Max 4 weeks for display simplicity, as per mock data implied
};

const getMonthsInSemester = (year, semester) => { // semester is '1st' or '2nd'
    const months = [];
    let startMonth, endMonth; // 0-indexed

    if (semester === '1st') { // Sep (prev year) to Jan (current year)
        // Sep, Oct, Nov (prev year)
        for (let i = 8; i <= 10; i++) months.push({ name: new Date(year - 1, i).toLocaleString('en-US', { month: 'long' }), year: year - 1, monthIndex: i });
        // Dec (prev year), Jan (current year) - Acceptance criteria for 1st Sem: Sep to Jan
        months.push({ name: new Date(year - 1, 11).toLocaleString('en-US', { month: 'long' }), year: year - 1, monthIndex: 11 });
        months.push({ name: new Date(year, 0).toLocaleString('en-US', { month: 'long' }), year: year, monthIndex: 0 });
    } else { // '2nd' semester: Feb to July (current year)
        for (let i = 1; i <= 6; i++) months.push({ name: new Date(year, i).toLocaleString('en-US', { month: 'long' }), year: year, monthIndex: i });
    }
    return months;
};


// --- Modified getPerformanceSummary ---
const getPerformanceSummary = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value: specificValue } = req.query;

    if (!filterPeriod) {
        res.status(400);
        throw new Error("Filter period (e.g., 'daily', 'weekly', 'monthly', 'semestral') is required.");
    }

    const resultsArray = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth();

    const calculateSummaryForPeriod = async (periodName, startDate, endDate) => {
        const matchStage = {
            dateChecked: { $gte: startDate, $lte: endDate },
            status: { $ne: 'INELIGIBLE_STUDENT_NOT_FOUND' }
        };
        const aggregation = await MealRecord.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } },
                    unclaimedEligible: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } }, // For more detailed "unclaimed"
                    unclaimedNotScheduled: { $sum: { $cond: [{ $eq: ['$status', 'INELIGIBLE_NOT_SCHEDULED'] }, 1, 0] } },
                    allotted: {
                        $sum: {
                            $cond: [ // Allotted could be claimed + eligible_but_not_claimed
                                { $or: [{ $eq: ['$status', 'CLAIMED'] }, { $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }] }, 1, 0
                            ]
                        }
                    }
                    // Your original 'allotted' was based on uniqueStudentsWithRecord.
                    // For a daily/weekly summary, 'allotted' often means "scheduled & eligible".
                    // Let's use: claimed + eligible_but_not_claimed for now.
                }
            },
            {
                $project: {
                    _id: 0, claimed: 1, unclaimedEligible: 1, unclaimedNotScheduled: 1, allotted: 1
                }
            }
        ]);
        const result = aggregation[0] || { claimed: 0, unclaimedEligible: 0, unclaimedNotScheduled: 0, allotted: 0 };
        const totalUnclaimed = result.unclaimedEligible + result.unclaimedNotScheduled;

        return {
            dayName: periodName, // For frontend display consistency with mock data
            claimed: result.claimed,
            unclaimed: totalUnclaimed, // Combined unclaimed
            allotted: result.allotted,
            claimedRatio: result.allotted > 0 ? parseFloat(((result.claimed / result.allotted) * 100).toFixed(2)) : 0,
            unclaimedRatio: result.allotted > 0 ? parseFloat(((totalUnclaimed / result.allotted) * 100).toFixed(2)) : 0,
        };
    };

    switch (filterPeriod.toLowerCase()) {
        case 'daily': // Shows summary for a SINGLE specified day
            const targetDate = specificValue ? new Date(specificValue) : now;
            if (isNaN(targetDate.getTime())) { res.status(400); throw new Error('Invalid date value for daily filter.'); }
            const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
            const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));
            resultsArray.push(await calculateSummaryForPeriod(
                dayStart.toLocaleDateString('en-US', { weekday: 'long' }), // Day name for this specific date
                dayStart,
                dayEnd
            ));
            break;
        case 'weekly': // Shows 6 daily summaries (Mon-Sat) for the specified week
            const weekRefDate = specificValue ? new Date(specificValue) : now; // specificValue should be a date within the week, e.g., Monday's date
            if (isNaN(weekRefDate.getTime())) { res.status(400); throw new Error('Invalid date value for weekly filter.'); }
            const daysInSelectedWeek = getDaysInWeek(weekRefDate);
            for (const day of daysInSelectedWeek) {
                const dayEnd = new Date(day.date); dayEnd.setHours(23, 59, 59, 999);
                resultsArray.push(await calculateSummaryForPeriod(day.name, day.date, dayEnd));
            }
            break;
        case 'monthly': // Shows 4 weekly summaries for the specified month
            const monthYearParts = specificValue ? specificValue.split('-') : [currentYear, currentMonthIndex + 1];
            const yearForMonth = parseInt(monthYearParts[0]);
            const monthForMonth = parseInt(monthYearParts[1]) - 1; // 0-indexed
            if (isNaN(yearForMonth) || isNaN(monthForMonth)) { res.status(400); throw new Error('Invalid value for monthly filter. Use YYYY-MM.'); }
            const weeksInSelectedMonth = getWeeksInMonth(yearForMonth, monthForMonth);
            for (const week of weeksInSelectedMonth) {
                resultsArray.push(await calculateSummaryForPeriod(week.name, week.startDate, week.endDate));
            }
            break;
        case 'semestral': // Shows monthly summaries for the specified semester
            const yearForSem = currentYear; // Semester is for current academic year context
            if (specificValue !== '1st' && specificValue !== '2nd') { res.status(400); throw new Error("Invalid value for semestral filter. Use '1st' or '2nd'."); }
            const monthsInSelectedSem = getMonthsInSemester(yearForSem, specificValue);
            for (const monthInfo of monthsInSelectedSem) {
                const monthStart = new Date(monthInfo.year, monthInfo.monthIndex, 1);
                const monthEnd = new Date(monthInfo.year, monthInfo.monthIndex + 1, 0, 23, 59, 59, 999);
                resultsArray.push(await calculateSummaryForPeriod(monthInfo.name, monthStart, monthEnd));
            }
            break;
        default:
            res.status(400);
            throw new Error('Invalid filter period specified.');
    }

    res.status(200).json({
        success: true,
        filterDetails: { filterPeriod, value: specificValue },
        data: resultsArray // Now returns an array of summary objects
    });
});

// Keep getProgramBreakdown as is for now, or modify it similarly if its UI also expects an array of breakdowns
const getProgramBreakdown = asyncHandler(async (req, res, next) => {
    // ... (Your existing getProgramBreakdown logic that returns all programs for ONE period)
    // If this also needs to return an array of (sub-period program breakdowns),
    // it would need a similar looping structure as the modified getPerformanceSummary.
    // For now, assuming it gives data for the overall selected period.
    const { filterPeriod, value } = req.query;
    if (!filterPeriod) {
        res.status(400);
        return next(new Error("Filter period (e.g., 'daily', 'weekly', 'monthly', 'semestral') is required."));
    }
    const { startDate, endDate, error: dateError } = getFilterDateRange(filterPeriod, value); // Uses original getFilterDateRange

    if (dateError) {
        res.status(400);
        return next(new Error(dateError));
    }

    const matchStage = { dateChecked: { $gte: startDate, $lte: endDate }, status: { $ne: 'INELIGIBLE_STUDENT_NOT_FOUND' } };
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
    res.status(200).json({ success: true, filterDetails: { filterPeriod, value, startDate, endDate }, data: programBreakdown });
});


module.exports = {
    getPerformanceSummary,
    getProgramBreakdown,
};