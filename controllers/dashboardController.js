const MealRecord = require('../models/MealRecordModel');
const asyncHandler = require('express-async-handler');

const getPeriodRange = (periodType, value) => {
    let startDate, endDate;
    const now = new Date();
    // Use the provided value for the year, or default to the current year
    const referenceYear = value ? new Date(value).getFullYear() : now.getFullYear();

    switch (periodType.toLowerCase()) {
        case 'daily': {
            const targetDate = value ? new Date(value) : now;
            if (isNaN(targetDate.getTime())) return { error: 'Invalid date format for daily filter. Use YYYY-MM-DD.' };
            startDate = new Date(targetDate);
            startDate.setUTCHours(0, 0, 0, 0);
            endDate = new Date(targetDate);
            endDate.setUTCHours(23, 59, 59, 999);
            break;
        }
        case 'weekly': {
            const weekRefDate = value ? new Date(value) : now;
            if (isNaN(weekRefDate.getTime())) return { error: 'Invalid date for week period. Provide a YYYY-MM-DD date for any day in the target week.' };
            
            startDate = new Date(weekRefDate);
            const dayOfWeek = startDate.getUTCDay(); // Sunday = 0, Monday = 1
            const diffToMonday = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
            startDate.setUTCDate(startDate.getUTCDate() + diffToMonday);
            startDate.setUTCHours(0, 0, 0, 0);

            endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 6); // End on Sunday
            endDate.setUTCHours(23, 59, 59, 999);
            break;
        }
        case 'monthly': {
            let year, month;
            if (value && value.includes('-')) {
                const parts = value.split('-');
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1; // JS month is 0-indexed
            } else {
                year = now.getFullYear();
                month = now.getMonth();
            }
            if (isNaN(year) || isNaN(month)) return { error: 'Invalid format for monthly filter. Use YYYY-MM.' };
            startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
            endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            break;
        }
        case 'semestral': {
            // value is '1st' or '2nd'. The academic year starts in September.
            // Let's establish the academic year based on the reference year.
            // If we are before September of referenceYear, the academic year is (refYear - 1) to refYear.
            // If we are in or after September, the academic year is refYear to (refYear + 1).
            const academicYearStart = now.getUTCMonth() >= 8 ? referenceYear : referenceYear - 1;

            if (value === '1st') { // Sept (academicYearStart) to Jan (academicYearStart + 1)
                startDate = new Date(Date.UTC(academicYearStart, 8, 1)); // September 1st
                endDate = new Date(Date.UTC(academicYearStart + 1, 1, 0, 23, 59, 59, 999)); // End of Jan
            } else if (value === '2nd') { // Feb (academicYearStart + 1) to July (academicYearStart + 1)
                startDate = new Date(Date.UTC(academicYearStart + 1, 1, 1)); // February 1st
                endDate = new Date(Date.UTC(academicYearStart + 1, 7, 0, 23, 59, 59, 999)); // End of July
            } else { return { error: "Invalid semester value. Use '1st' or '2nd'." }; }
            break;
        }
        default:
            return { error: 'Invalid period type specified.' };
    }
    return { startDate, endDate, error: null };
};

const calculateSummaryForSinglePeriod = async (startDate, endDate) => {
    const matchStage = {
        dateChecked: { $gte: startDate, $lte: endDate },
        status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] }
    };
    const aggregationResult = await MealRecord.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } },
                unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } }
            }
        },
        { $project: { _id: 0, claimed: 1, unclaimed: 1 } }
    ]);

    let periodSummary = { allotted: 0, claimed: 0, unclaimed: 0 };
    if (aggregationResult.length > 0) {
        const result = aggregationResult[0];
        periodSummary.claimed = result.claimed || 0;
        periodSummary.unclaimed = result.unclaimed || 0;
        periodSummary.allotted = periodSummary.claimed + periodSummary.unclaimed;
    }
    return periodSummary;
};

const getPerformanceSummary = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value } = req.query;

    if (!filterPeriod) {
        return res.status(400).json({ success: false, error: "Filter period is required." });
    }
    const normalizedFilterPeriod = filterPeriod.toLowerCase();
    
    let responseData = [];
    let filterDetailsForResponse = { filterPeriod, value, startDate: null, endDate: null };

    if (normalizedFilterPeriod === 'daily') {
        const range = getPeriodRange('daily', value);
        if (range.error) return res.status(400).json({ success: false, error: range.error });

        const summary = await calculateSummaryForSinglePeriod(range.startDate, range.endDate);
        responseData.push({ 
            id: range.startDate.toISOString().split('T')[0], 
            name: range.startDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }), 
            ...summary 
        });
        filterDetailsForResponse.startDate = range.startDate;
        filterDetailsForResponse.endDate = range.endDate;
    } 
    else if (normalizedFilterPeriod === 'weekly') {
        const weekRange = getPeriodRange('weekly', value);
        if (weekRange.error) return res.status(400).json({ success: false, error: weekRange.error });

        filterDetailsForResponse.startDate = weekRange.startDate;
        filterDetailsForResponse.endDate = weekRange.endDate;

        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        for (let i = 0; i < days.length; i++) {
            const currentDayStart = new Date(weekRange.startDate);
            currentDayStart.setUTCDate(weekRange.startDate.getUTCDate() + i);
            const currentDayEnd = new Date(currentDayStart);
            currentDayEnd.setUTCHours(23, 59, 59, 999);
            
            const daySummary = await calculateSummaryForSinglePeriod(currentDayStart, currentDayEnd);
            responseData.push({ id: i + 1, name: days[i], ...daySummary });
        }
    } 
    else if (normalizedFilterPeriod === 'monthly') {
        const monthRange = getPeriodRange('monthly', value);
        if (monthRange.error) return res.status(400).json({ success: false, error: monthRange.error });

        filterDetailsForResponse.startDate = monthRange.startDate;
        filterDetailsForResponse.endDate = monthRange.endDate;

        let weekStart = new Date(monthRange.startDate);
        let weekCounter = 1;
        while (weekStart <= monthRange.endDate) {
            const weekRange = getPeriodRange('weekly', weekStart.toISOString().split('T')[0]);
            const effectiveStart = weekRange.startDate < monthRange.startDate ? monthRange.startDate : weekRange.startDate;
            const effectiveEnd = weekRange.endDate > monthRange.endDate ? monthRange.endDate : weekRange.endDate;

            const weeklySummary = await calculateSummaryForSinglePeriod(effectiveStart, effectiveEnd);
            responseData.push({ id: weekCounter, name: `Week ${weekCounter}`, ...weeklySummary });

            weekStart = new Date(weekRange.endDate);
            weekStart.setUTCDate(weekRange.endDate.getUTCDate() + 1);
            weekCounter++;
        }
    } 
    else if (normalizedFilterPeriod === 'semestral') {
        const semRange = getPeriodRange('semestral', value);
        if (semRange.error) return res.status(400).json({ success: false, error: semRange.error });
        
        filterDetailsForResponse.startDate = semRange.startDate;
        filterDetailsForResponse.endDate = semRange.endDate;

        const startMonth = semRange.startDate.getUTCMonth();
        const startYear = semRange.startDate.getUTCFullYear();
        const endMonth = semRange.endDate.getUTCMonth();
        const endYear = semRange.endDate.getUTCFullYear();
        
        for (let yr = startYear; yr <= endYear; yr++) {
            const mStart = (yr === startYear) ? startMonth : 0;
            const mEnd = (yr === endYear) ? endMonth : 11;
            for (let m = mStart; m <= mEnd; m++) {
                const monthStartDate = new Date(Date.UTC(yr, m, 1));
                const monthName = monthStartDate.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
                const monthEndDate = new Date(Date.UTC(yr, m + 1, 0, 23, 59, 59, 999));
                
                const monthlySummary = await calculateSummaryForSinglePeriod(monthStartDate, monthEndDate);
                responseData.push({ id: `${yr}-${m + 1}`, name: monthName, ...monthlySummary });
            }
        }
    } else {
        return res.status(400).json({ success: false, error: "Invalid filter period for summary." });
    }

    res.status(200).json({
        success: true,
        filterDetails: filterDetailsForResponse,
        data: responseData
    });
});

const getProgramBreakdown = asyncHandler(async (req, res, next) => {
    const { filterPeriod, value, program, groupBy } = req.query;

    if (!filterPeriod) {
        return res.status(400).json({ success: false, error: "Filter period is required." });
    }
    
    const range = getPeriodRange(filterPeriod.toLowerCase(), value);
    if (range.error) {
        return res.status(400).json({ success: false, error: range.error });
    }

    const matchStage = {
        dateChecked: { $gte: range.startDate, $lte: range.endDate },
        status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] }
    };

    // If a specific program is requested, add it to the match stage
    if (program) {
        matchStage.programAtTimeOfRecord = program.toUpperCase();
    }

    // Determine the grouping key based on the 'groupBy' query param
    let groupKey;
    if (groupBy === 'yearLevel' && program) {
        // Group by year level (and append ' year' for frontend-friendly naming)
        groupKey = { $concat: [{ $toString: "$yearLevelAtTimeOfRecord" }, " year"] };
    } else {
        // Default to grouping by program name
        groupKey = '$programAtTimeOfRecord';
    }

    const aggregationPipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: groupKey,
                claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } },
                unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                name: '$_id', // Use 'name' for frontend compatibility
                claimed: 1,
                unclaimed: 1,
                allotted: { $add: ['$claimed', '$unclaimed'] }
            }
        },
        { $sort: { name: 1 } }
    ];

    const breakdownData = await MealRecord.aggregate(aggregationPipeline);

    res.status(200).json({
        success: true,
        filterDetails: { filterPeriod, value, program, groupBy, startDate: range.startDate.toISOString(), endDate: range.endDate.toISOString() },
        data: breakdownData
    });
});

module.exports = {
    getPerformanceSummary,
    getProgramBreakdown,
};