// controllers/dashboardController.js
const MealRecord = require('../models/MealRecordModel');
const asyncHandler = require('express-async-handler');

// --- Helper: Calculates start and end date for various single periods ---
// value for 'daily' and 'weekly' should be a YYYY-MM-DD string
// value for 'monthly' should be YYYY-MM
// value for 'semester' should be '1st' or '2nd'
const getSpecificPeriodRange = (periodType, value, currentYear = new Date().getFullYear()) => {
    let startDate, endDate;
    const today = new Date(); // For defaults if value is not provided or invalid for some cases

    switch (periodType.toLowerCase()) {
        case 'daily': 
            const targetDate = value ? new Date(value) : today;
            if (isNaN(targetDate.getTime())) return { error: 'Invalid date for day period. Use YYYY-MM-DD.' };
            startDate = new Date(targetDate); startDate.setHours(0,0,0,0);
            endDate = new Date(targetDate); endDate.setHours(23,59,59,999);
            break;
        case 'weekly': 
            const weekRefDate = value ? new Date(value) : today; 
            if (isNaN(weekRefDate.getTime())) return { error: 'Invalid date for week period. Provide YYYY-MM-DD for any day in the week.' };
            startDate = new Date(weekRefDate);
            const dayOfWeek = startDate.getDay(); // Sunday = 0, Monday = 1
            const diffToMonday = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
            startDate.setDate(startDate.getDate() + diffToMonday);
            startDate.setHours(0,0,0,0);
            endDate = new Date(startDate); 
            endDate.setDate(startDate.getDate() + 6); // End on Sunday
            endDate.setHours(23,59,59,999);
            break;
        case 'monthly': 
            let yearForMonth, monthForMonth;
            if (value && value.includes('-')) {
                const parts = value.split('-');
                yearForMonth = parseInt(parts[0]);
                monthForMonth = parseInt(parts[1]) - 1; // JS month is 0-indexed
            } else { // Default to current month of currentYear
                yearForMonth = currentYear;
                monthForMonth = today.getMonth();
            }
            if (isNaN(yearForMonth) || isNaN(monthForMonth)) return { error: 'Invalid value for month period. Use YYYY-MM.' };
            startDate = new Date(yearForMonth, monthForMonth, 1, 0,0,0,0);
            endDate = new Date(yearForMonth, monthForMonth + 1, 0, 23,59,59,999);
            break;
        case 'semestral': // value is '1st' or '2nd', currentYear is the academic year start (e.g. 2024 for 2024-2025)
            if (value === '1st') { // Sept (currentYear) to Jan (currentYear + 1)
                startDate = new Date(currentYear, 8, 1); // September 1st
                endDate = new Date(currentYear + 1, 0, 31, 23,59,59,999); // January 31st of next year
            } else if (value === '2nd') { // Feb (currentYear + 1) to July (currentYear + 1)
                startDate = new Date(currentYear + 1, 1, 1); // February 1st of next year
                endDate = new Date(currentYear + 1, 6, 31, 23,59,59,999); // July 31st of next year
            } else { return { error: "Invalid semester value. Use '1st' or '2nd'." }; }
            break;
        default: return { error: 'Invalid period type for range.' };
    }
    return { startDate, endDate, error: null };
};

// --- Helper: Calculates summary for a specific date range ---
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
            unclaimed: { $sum: { $cond: [ { $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0]}},
            // Add other status counts if needed for different definitions of 'allotted' or 'unclaimed'
            // For example, count of INELIGIBLE_NOT_SCHEDULED could be another metric
        }},
        { $project: { _id: 0, claimed: 1, unclaimed: 1 }}
    ]);

    let periodSummary = { allotted: 0, claimed: 0, unclaimed: 0, claimedRatio: 0, unclaimedRatio: 0, name: "" };

    if (aggregationResult.length > 0) {
        const result = aggregationResult[0];
        periodSummary.claimed = result.claimed || 0;
        periodSummary.unclaimed = result.unclaimed || 0; // This specifically means ELIGIBLE_BUT_NOT_CLAIMED

        // 'allotted' for ratio calculation purposes is claimed + (eligible_but_not_claimed)
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
    const { filterPeriod, value } = req.query; // `value` is now optional for some periods, backend defaults
    const currentCalendarYear = new Date().getFullYear(); // For default year context

    if (!filterPeriod) {
        res.status(400); return next(new Error("Filter period is required."));
    }
    const normalizedFilterPeriod = filterPeriod.toLowerCase();
    
    let responseData = [];
    let filterDetailsForResponse = { filterPeriod, value }; // Will add startDate, endDate later

    switch (normalizedFilterPeriod) {
        case 'daily': // Returns Mon-Sat/Fri of current week (value is ignored for now, uses current week)
            let currentMonday = new Date();
            currentMonday.setDate(currentMonday.getDate() - (currentMonday.getDay() === 0 ? 6 : currentMonday.getDay() - 1));
            currentMonday.setHours(0,0,0,0);
            
            filterDetailsForResponse.startDate = new Date(currentMonday);
            const daysToDisplay = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            for (let i = 0; i < daysToDisplay.length; i++) {
                const dayDate = new Date(currentMonday);
                dayDate.setDate(currentMonday.getDate() + i);
                const dayStart = new Date(dayDate); dayStart.setHours(0,0,0,0);
                const dayEnd = new Date(dayDate); dayEnd.setHours(23,59,59,999);

                const summary = await calculateSummaryForSinglePeriod(dayStart, dayEnd);
                responseData.push({ id: i + 1, dayName: daysToDisplay[i], ...summary });
            }
            filterDetailsForResponse.endDate = new Date(currentMonday);
            filterDetailsForResponse.endDate.setDate(currentMonday.getDate() + daysToDisplay.length -1);
            filterDetailsForResponse.endDate.setHours(23,59,59,999);
            break;

        case 'weekly': // Returns Week 1-4/5 of current month (value ignored for now, uses current month)
            const todayForWeekly = new Date();
            const currentMonthForWeekly = todayForWeekly.getMonth();
            const yearForWeekly = todayForWeekly.getFullYear();
            let weekCounter = 1;
            let dateInWeek = new Date(yearForWeekly, currentMonthForWeekly, 1);

            filterDetailsForResponse.startDate = new Date(dateInWeek); // Start of month
            filterDetailsForResponse.endDate = new Date(yearForWeekly, currentMonthForWeekly + 1, 0, 23,59,59,999); // End of month

            while (dateInWeek.getMonth() === currentMonthForWeekly && weekCounter <= 5) {
                const weekRange = getSpecificPeriodRange('week', dateInWeek.toISOString().split('T')[0], yearForWeekly);
                if (weekRange.error) break; 
                // Ensure the week actually starts within the target month
                if(weekRange.startDate.getMonth() !== currentMonthForWeekly && weekCounter > 1) break;


                const weeklySummary = await calculateSummaryForSinglePeriod(weekRange.startDate, weekRange.endDate);
                responseData.push({ id: weekCounter, dayName: `Week ${weekCounter}`, ...weeklySummary });
                
                dateInWeek.setDate(weekRange.startDate.getDate() + 7);
                weekCounter++;
            }
            break;

        case 'monthly': // Returns Jan-Dec of current year (value ignored for now, uses current year)
            filterDetailsForResponse.startDate = new Date(currentCalendarYear, 0, 1);
            filterDetailsForResponse.endDate = new Date(currentCalendarYear, 11, 31, 23,59,59,999);
            for (let m = 0; m < 12; m++) {
                const monthRange = getSpecificPeriodRange('month', `${currentCalendarYear}-${(m + 1).toString().padStart(2, '0')}`, currentCalendarYear);
                if (monthRange.error) continue;
                const monthlySummary = await calculateSummaryForSinglePeriod(monthRange.startDate, monthRange.endDate);
                responseData.push({ 
                    id: m + 1, 
                    dayName: monthRange.startDate.toLocaleDateString('en-US', { month: 'long' }), 
                    ...monthlySummary 
                });
            }
            break;

        case 'semestral': // Returns "1st Semester", "2nd Semester" for current academic year context
                        // 'value' here (1st/2nd) is crucial. getSpecificPeriodRange uses currentCalendarYear for academic year start
            const sem1Range = getSpecificPeriodRange('semester', '1st', currentCalendarYear); // Assumes currentCalendarYear is start of academic year for 1st sem
            if (!sem1Range.error) {
                const sem1Summary = await calculateSummaryForSinglePeriod(sem1Range.startDate, sem1Range.endDate);
                responseData.push({ id: '1st', dayName: '1st Semester', ...sem1Summary });
                filterDetailsForResponse.startDateSem1 = sem1Range.startDate; // For context
                filterDetailsForResponse.endDateSem1 = sem1Range.endDate;
            }
            const sem2Range = getSpecificPeriodRange('semester', '2nd', currentCalendarYear -1); // If 2nd sem is Feb-July of currentCalendarYear (part of prev academic year)
                                                                                        // Or currentCalendarYear if 2nd sem is Feb(Year+1) to July(Year+1) of current academic year.
                                                                                        // This needs a clear definition of "academic year" for the query.
                                                                                        // For now, using currentCalendarYear-1 assumes 2nd sem of current display year belongs to previous academic year.
            if (!sem2Range.error) {
                const sem2Summary = await calculateSummaryForSinglePeriod(sem2Range.startDate, sem2Range.endDate);
                responseData.push({ id: '2nd', dayName: '2nd Semester', ...sem2Summary });
                filterDetailsForResponse.startDateSem2 = sem2Range.startDate; // For context
                filterDetailsForResponse.endDateSem2 = sem2Range.endDate;
            }
            // Note: The date ranges for semestral might need adjustment based on your specific academic calendar.
            break;
            
        default:
            res.status(400); return next(new Error("Invalid filter period for summary."));
    }

    res.status(200).json({
        success: true,
        filterDetails: filterDetailsForResponse,
        data: responseData
    });
});

// --- @desc Get program/year breakdown ---
const getProgramBreakdown = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value } = req.query; // Value here is the specific sub-period label e.g. "Monday", "Week 1", "January"
    const currentCalendarYear = new Date().getFullYear();

    if (!filterPeriod) { 
        res.status(400); 
        return next(new Error("Filter period is required."));
    }

    // Use the getApiParamsFromSelection logic (or similar) to translate UI filter values to precise date ranges
    // For example, if filterPeriod="Daily" from UI and value="Monday" from UI's barGroup dropdown,
    // we need to find the actual date for that Monday.
    // The getSpecificPeriodRange helper expects more precise values.
    // Let's assume 'value' passed to this endpoint is already a backend-compatible value (YYYY-MM-DD, YYYY-MM, 1st/2nd)
    // or the filterPeriod itself implies a default (e.g. filterPeriod=daily implies today if no value)

    const range = getSpecificPeriodRange(filterPeriod.toLowerCase(), value, currentCalendarYear);

    if (range.error) { 
        res.status(400); 
        return next(new Error(range.error)); 
    }

    const matchStage = {
        dateChecked: { $gte: range.startDate, $lte: range.endDate },
        status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] }
    };

    const aggregationPipeline = [
        { $match: matchStage },
        { $group: {
            _id: '$programAtTimeOfRecord',
            claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } },
            unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } }
        }},
        { $project: {
            _id: 0, program: '$_id', claimed: 1, unclaimed: 1,
            allotted: { $add: ['$claimed', '$unclaimed'] }
        }},
        { $addFields: {
            claimedRatio: { $cond: [ { $eq: ['$allotted', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$claimed', '$allotted'] }, 100] }, 2] } ]},
            unclaimedRatio: { $cond: [ { $eq: ['$allotted', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$unclaimed', '$allotted'] }, 100] }, 2] } ]}
        }},
        { $project: { totalForRatio: 0 } },
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