// controllers/dashboardController.js
const MealRecord = require('../models/MealRecordModel');
const asyncHandler = require('express-async-handler');
// Removed mongoose, Schedule, Student as not directly used in the refined versions

// --- Helper: Calculates start and end date for various periods ---
// This function needs to be robust for all cases.
const getFilterDateRange = (filterPeriod, value, currentYear = new Date().getFullYear()) => {
    const now = new Date();
    let startDate, endDate;
    let year = currentYear; // Use provided year, default to current

    switch (filterPeriod.toLowerCase()) {
        case 'daily': // Expects value = 'YYYY-MM-DD'
            const targetDate = value ? new Date(value) : now;
            if (isNaN(targetDate.getTime())) return { error: 'Invalid date format for daily filter. Use YYYY-MM-DD.' };
            startDate = new Date(targetDate); startDate.setHours(0, 0, 0, 0);
            endDate = new Date(targetDate); endDate.setHours(23, 59, 59, 999);
            break;
        case 'weekly': // Expects value = 'YYYY-MM-DD' (Monday of the target week)
            const weekRefDate = value ? new Date(value) : now;
            if (isNaN(weekRefDate.getTime())) return { error: 'Invalid date format for weekly filter. Provide YYYY-MM-DD for start of week.' };
            // Assuming 'value' is already the Monday
            startDate = new Date(weekRefDate); startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6); // Get Sunday
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'monthly': // Expects value = 'YYYY-MM'
            if (value) {
                const parts = value.split('-');
                if (parts.length === 2 && !isNaN(parseInt(parts[0])) && !isNaN(parseInt(parts[1]))) {
                    year = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1; // JS month is 0-indexed
                    startDate = new Date(year, month, 1, 0, 0, 0, 0);
                    endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
                } else { return { error: 'Invalid format for monthly filter. Use YYYY-MM.' }; }
            } else { // Default to current month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            }
            break;
        case 'semestral': // Expects value = '1st' or '2nd'
            if (value === '1st') { // Sept (current year) to Jan (next year) - typical academic sem
                startDate = new Date(year, 8, 1); // September 1st
                endDate = new Date(year + 1, 0, 31, 23, 59, 59, 999); // January 31st of next year
            } else if (value === '2nd') { // Feb to July of next year (following '1st' sem)
                startDate = new Date(year + 1, 1, 1); // February 1st of next year
                endDate = new Date(year + 1, 6, 31, 23, 59, 59, 999); // July 31st of next year
            } else { return { error: "Invalid value for semestral filter. Use '1st' or '2nd'." }; }
            break;
        default:
            return { error: 'Invalid filter period specified.' };
    }
    return { startDate, endDate };
};

// For clarity, let's use the version of calculateSummaryForSinglePeriod that correctly identifies 'unclaimed'
// as ELIGIBLE_BUT_NOT_CLAIMED for the purpose of your frontend's "unclaimed" display.
const calculateSummaryForSinglePeriod = async (startDate, endDate) => {
    const matchStage = {
        dateChecked: { $gte: startDate, $lte: endDate },
        status: { $ne: 'INELIGIBLE_STUDENT_NOT_FOUND' }
    };
    const aggregationResult = await MealRecord.aggregate([
        { $match: matchStage },
        { $group: {
            _id: null,
            claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } },
            // This 'unclaimed' is specifically 'ELIGIBLE_BUT_NOT_CLAIMED' for your table's definition
            unclaimed: { $sum: { $cond: [ { $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0]}},
            // If you also want to count 'INELIGIBLE_NOT_SCHEDULED' separately for other metrics:
            // ineligibleNotScheduled: { $sum: { $cond: [ { $eq: ['$status', 'INELIGIBLE_NOT_SCHEDULED'] }, 1, 0]}},
            // 'allotted' for the summary table will be the sum of claimed + this specific unclaimed
        }},
        { $project: { _id: 0, claimed: 1, unclaimed: 1 /*, ineligibleNotScheduled: 1 */ }}
    ]);

    let periodSummary = { 
        allotted: 0, // This will be claimed + unclaimed (eligible_but_not_claimed)
        claimed: 0, 
        unclaimed: 0, // This is eligible_but_not_claimed
        claimedRatio: 0, 
        unclaimedRatio: 0,
        name: ""
    };

    if (aggregationResult.length > 0) {
        const result = aggregationResult[0];
        periodSummary.claimed = result.claimed || 0;
        periodSummary.unclaimed = result.unclaimed || 0; // This is ELIGIBLE_BUT_NOT_CLAIMED

        // 'allotted' for the ratio is the sum of outcomes for eligible students
        periodSummary.allotted = periodSummary.claimed + periodSummary.unclaimed;

        if (periodSummary.allotted > 0) {
            periodSummary.claimedRatio = parseFloat(((periodSummary.claimed / periodSummary.allotted) * 100).toFixed(2));
            periodSummary.unclaimedRatio = parseFloat(((periodSummary.unclaimed / periodSummary.allotted) * 100).toFixed(2));
        }
    }
    return periodSummary;
};

// --- @desc Get performance summary ---
const getPerformanceSummary = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value } = req.query;
    const currentYear = new Date().getFullYear(); // Or pass from frontend if year selection is added

    if (!filterPeriod) {
        res.status(400); return next(new Error("Filter period is required."));
    }
    const normalizedFilterPeriod = filterPeriod.toLowerCase();
    
    let responseData = [];
    let filterDetailsForResponse = { filterPeriod, value, startDate: null, endDate: null };

    if (normalizedFilterPeriod === 'daily') {
        const range = getFilterDateRange('daily', value); // value should be YYYY-MM-DD
        if (range.error) { res.status(400); return next(new Error(range.error)); }
        filterDetailsForResponse.startDate = range.startDate;
        filterDetailsForResponse.endDate = range.endDate;
        const summary = await calculateSummaryForSinglePeriod(range.startDate, range.endDate);
        summary.dayName = range.startDate.toLocaleDateString('en-US', { weekday: 'long' }); // Or use value
        summary.name = `Report for ${range.startDate.toLocaleDateString()}`;
        responseData = [summary]; // Frontend expects an array
    } 
    else if (normalizedFilterPeriod === 'weekly') {
        const weekRange = getFilterDateRange('weekly', value); // value should be YYYY-MM-DD (Monday of week)
        if (weekRange.error) { res.status(400); return next(new Error(weekRange.error)); }
        filterDetailsForResponse.startDate = weekRange.startDate;
        filterDetailsForResponse.endDate = weekRange.endDate;

        for (let i = 0; i < 5; i++) { // Monday to Friday
            const currentDayStart = new Date(weekRange.startDate);
            currentDayStart.setDate(weekRange.startDate.getDate() + i);
            const currentDayEnd = new Date(currentDayStart);
            currentDayEnd.setHours(23, 59, 59, 999);
            
            const dayName = currentDayStart.toLocaleDateString('en-US', { weekday: 'long' });
            const dailySummary = await calculateSummaryForSinglePeriod(currentDayStart, currentDayEnd);
            responseData.push({ id: i + 1, dayName, ...dailySummary });
        }
    } 
    else if (normalizedFilterPeriod === 'monthly') {
        const monthRange = getFilterDateRange('monthly', value, currentYear); // value should be YYYY-MM
        if (monthRange.error) { res.status(400); return next(new Error(monthRange.error)); }
        filterDetailsForResponse.startDate = monthRange.startDate;
        filterDetailsForResponse.endDate = monthRange.endDate;

        let weekStart = new Date(monthRange.startDate);
        // Adjust weekStart to be the first Monday of or before the month starts
        weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));

        for (let w = 1; w <= 4; w++) { // Iterate up to 4 weeks
            const currentWeekMonday = new Date(weekStart);
            currentWeekMonday.setDate(weekStart.getDate() + (w - 1) * 7);
            
            // Ensure the Monday is not past the end of the month for the start of the week.
            if (currentWeekMonday.getMonth() !== monthRange.startDate.getMonth() && currentWeekMonday > monthRange.startDate ) break;


            const currentWeekSunday = new Date(currentWeekMonday);
            currentWeekSunday.setDate(currentWeekMonday.getDate() + 6); // Get Sunday of that week
            currentWeekSunday.setHours(23,59,59,999);

            // Clip the week's actual start/end to be within the month's boundaries
            const effectiveWeekStart = currentWeekMonday < monthRange.startDate ? monthRange.startDate : currentWeekMonday;
            const effectiveWeekEnd = currentWeekSunday > monthRange.endDate ? monthRange.endDate : currentWeekSunday;
            
            if(effectiveWeekStart > effectiveWeekEnd) continue; // Skip if week is entirely outside month (e.g. for week 4 of Feb)


            const weeklySummary = await calculateSummaryForSinglePeriod(effectiveWeekStart, effectiveWeekEnd);
            responseData.push({ id: w, dayName: `Week ${w}`, ...weeklySummary });
        }
    } 
    else if (normalizedFilterPeriod === 'semestral') {
        const semRange = getFilterDateRange('semestral', value, currentYear); // value is '1st' or '2nd'
        if (semRange.error) { res.status(400); return next(new Error(semRange.error)); }
        filterDetailsForResponse.startDate = semRange.startDate;
        filterDetailsForResponse.endDate = semRange.endDate;

        const startMonth = semRange.startDate.getMonth();
        const endMonth = semRange.endDate.getMonth();
        const startYr = semRange.startDate.getFullYear();
        const endYr = semRange.endDate.getFullYear();

        for (let yr = startYr; yr <= endYr; yr++) {
            const M_start = (yr === startYr) ? startMonth : 0;
            const M_end = (yr === endYr) ? endMonth : 11;
            for (let m = M_start; m <= M_end; m++) {
                const monthStartDate = new Date(yr, m, 1);
                const monthEndDate = new Date(yr, m + 1, 0, 23, 59, 59, 999);
                const monthlySummary = await calculateSummaryForSinglePeriod(monthStartDate, monthEndDate);
                responseData.push({ 
                    id: `${yr}-${m+1}`, 
                    dayName: monthStartDate.toLocaleDateString('en-US', { month: 'long' }), 
                    ...monthlySummary 
                });
            }
        }
    } else {
        res.status(400); return next(new Error("Invalid filter period for summary."));
    }

    res.status(200).json({
        success: true,
        filterDetails: filterDetailsForResponse,
        data: responseData // This is now always an array for the table
    });
});


// --- @desc Get program/year breakdown ---
// This function will also need to align with the main selected filter period (filterPeriod & value)
// and return data for ALL programs for that specific period.
const getProgramBreakdown = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value } = req.query;
    const currentYear = new Date().getFullYear();

    if (!filterPeriod) { 
        res.status(400); 
        return next(new Error("Filter period is required."));
    }
    const range = getFilterDateRange(filterPeriod.toLowerCase(), value, currentYear);
    if (range.error) { 
        res.status(400); 
        return next(new Error(range.error)); 
    }

    const matchStage = {
        dateChecked: { $gte: range.startDate, $lte: range.endDate },
        status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] } // Only consider these for program breakdown
    };

    const aggregationPipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: '$programAtTimeOfRecord', // Group by program
                claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } },
                // 'unclaimed' here means 'ELIGIBLE_BUT_NOT_CLAIMED'
                unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                program: '$_id',
                claimed: 1,
                unclaimed: 1,
                // 'allotted' is the sum of claimed and (eligible but not claimed) for this program in this period
                allotted: { $add: ['$claimed', '$unclaimed'] }
            }
        },
        {
            $addFields: { // Calculate ratios using the correct 'allotted'
                claimedRatio: {
                    $cond: [
                        { $eq: ['$allotted', 0] }, 0,
                        { $round: [{ $multiply: [{ $divide: ['$claimed', '$allotted'] }, 100] }, 2] }
                    ]
                },
                unclaimedRatio: {
                    $cond: [
                        { $eq: ['$allotted', 0] }, 0,
                        { $round: [{ $multiply: [{ $divide: ['$unclaimed', '$allotted'] }, 100] }, 2] }
                    ]
                }
            }
        },
        { $sort: { program: 1 } }
    ];
    const programBreakdownData = await MealRecord.aggregate(aggregationPipeline);

    res.status(200).json({
        success: true,
        filterDetails: { filterPeriod, value, startDate: range.startDate, endDate: range.endDate },
        data: programBreakdownData
    });
});

module.exports = {
    getPerformanceSummary,
    getProgramBreakdown,
};