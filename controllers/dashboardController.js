const MealRecord = require('../models/MealRecordModel');
const asyncHandler = require('express-async-handler');

// Helper to get a date range. It's simplified for clarity.
const getPeriodRange = (periodType, value) => {
    let startDate, endDate;
    const now = new Date();
    
    switch (periodType.toLowerCase()) {
        case 'daily': { // Returns range for a single day
            const targetDate = value ? new Date(value) : now;
            if (isNaN(targetDate.getTime())) return { error: 'Invalid date. Use YYYY-MM-DD.' };
            startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
            endDate = new Date(startDate);
            endDate.setUTCHours(23, 59, 59, 999);
            break;
        }
        case 'weekly': { // Returns range for a whole week based on a date
             const weekRefDate = value ? new Date(value) : now;
            if (isNaN(weekRefDate.getTime())) return { error: 'Invalid date. Use YYYY-MM-DD.' };
            startDate = new Date(Date.UTC(weekRefDate.getUTCFullYear(), weekRefDate.getUTCMonth(), weekRefDate.getUTCDate()));
            const dayOfWeek = startDate.getUTCDay();
            const diffToMonday = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
            startDate.setUTCDate(startDate.getUTCDate() + diffToMonday);
            endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 6);
            endDate.setUTCHours(23, 59, 59, 999);
            break;
        }
        case 'monthly': { // Returns range for a specific month
            let year, month;
            if (value && value.includes('-')) {
                const parts = value.split('-');
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
            } else {
                year = now.getFullYear();
                month = now.getMonth();
            }
            if (isNaN(year) || isNaN(month)) return { error: 'Invalid month. Use YYYY-MM.' };
            startDate = new Date(Date.UTC(year, month, 1));
            endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            break;
        }
        case 'semestral': { // Returns range for a semester
            const academicYearStart = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
            if (value === '1st') {
                startDate = new Date(Date.UTC(academicYearStart, 8, 1));
                endDate = new Date(Date.UTC(academicYearStart + 1, 1, 0, 23, 59, 59, 999));
            } else if (value === '2nd') {
                startDate = new Date(Date.UTC(academicYearStart + 1, 1, 1));
                endDate = new Date(Date.UTC(academicYearStart + 1, 7, 0, 23, 59, 59, 999));
            } else { return { error: "Invalid semester value. Use '1st' or '2nd'." }; }
            break;
        }
        default: return { error: 'Invalid period type.' };
    }
    return { startDate, endDate, error: null };
};

const calculateSummaryForSinglePeriod = async (startDate, endDate) => {
    const aggregationResult = await MealRecord.aggregate([
        { $match: { dateChecked: { $gte: startDate, $lte: endDate }, status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] } } },
        { $group: { _id: null, claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } }, unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } } } },
        { $project: { _id: 0, claimed: 1, unclaimed: 1 } }
    ]);
    const result = aggregationResult[0] || { claimed: 0, unclaimed: 0 };
    return { claimed: result.claimed, unclaimed: result.unclaimed, allotted: result.claimed + result.unclaimed };
};

const getPerformanceSummary = asyncHandler(async (req, res) => {
    const { filterPeriod } = req.query;
    let responseData = [];

    switch (filterPeriod.toLowerCase()) {
        case 'daily': {
            const weekRange = getPeriodRange('weekly');
            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            for (let i = 0; i < 7; i++) {
                const currentDay = new Date(weekRange.startDate);
                currentDay.setUTCDate(currentDay.getUTCDate() + i);
                
                const endOfDay = new Date(currentDay);
                endOfDay.setUTCHours(23, 59, 59, 999);

                const summary = await calculateSummaryForSinglePeriod(currentDay, endOfDay);
                responseData.push({ id: currentDay.toISOString().split('T')[0], name: days[i], ...summary });
            }
            break;
        }
        case 'weekly': {
            const monthRange = getPeriodRange('monthly');
            let weekStart = new Date(monthRange.startDate);
            let weekCounter = 1;
            while (weekStart <= monthRange.endDate) {
                const weekRange = getPeriodRange('weekly', weekStart.toISOString());
                const summary = await calculateSummaryForSinglePeriod(weekRange.startDate, weekRange.endDate);
                
                responseData.push({ 
                    id: weekRange.startDate.toISOString().split('T')[0], 
                    name: `Week ${weekCounter}`, 
                    ...summary 
                });
                
                weekStart.setUTCDate(weekStart.getUTCDate() + 7);
                weekCounter++;
            }
            break;
        }
        case 'monthly': {
            const year = new Date().getFullYear();
            for (let m = 0; m < 12; m++) {
                const monthRange = getPeriodRange('monthly', `${year}-${m + 1}`);
                const summary = await calculateSummaryForSinglePeriod(monthRange.startDate, monthRange.endDate);
                const monthName = new Date(Date.UTC(year, m)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
                responseData.push({ id: `${year}-${m+1}`, name: monthName, ...summary });
            }
            break;
        }
        case 'semestral': {
            const sem1Range = getPeriodRange('semestral', '1st');
            const sem2Range = getPeriodRange('semestral', '2nd');
            const [sem1Summary, sem2Summary] = await Promise.all([
                calculateSummaryForSinglePeriod(sem1Range.startDate, sem1Range.endDate),
                calculateSummaryForSinglePeriod(sem2Range.startDate, sem2Range.endDate)
            ]);
            responseData.push({ id: '1st', name: '1st Semester', ...sem1Summary });
            responseData.push({ id: '2nd', name: '2nd Semester', ...sem2Summary });
            break;
        }
        default:
            return res.status(400).json({ success: false, error: "Invalid filter period for summary." });
    }
    res.status(200).json({ success: true, data: responseData });
});


const getProgramBreakdown = asyncHandler(async (req, res) => {
    const { filterPeriod, value, program, groupBy } = req.query;
    if (!filterPeriod || !value) {
        return res.status(400).json({ success: false, error: "Filter period and value are required." });
    }
    
    const range = getPeriodRange(filterPeriod.toLowerCase(), value);
    if (range.error) { return res.status(400).json({ success: false, error: range.error }); }

    const matchStage = { dateChecked: { $gte: range.startDate, $lte: range.endDate }, status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] } };
    if (program) { matchStage.programAtTimeOfRecord = program.toUpperCase(); }

    const groupKey = (groupBy === 'yearLevel' && program) ? { $concat: [{ $toString: "$yearLevelAtTimeOfRecord" }, " year"] } : '$programAtTimeOfRecord';
    
    const aggregationPipeline = [
        { $match: matchStage },
        { $group: { _id: groupKey, claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } }, unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } } } },
        { $project: { _id: 0, name: '$_id', claimed: 1, unclaimed: 1, allotted: { $add: ['$claimed', '$unclaimed'] } } },
        { $sort: { name: 1 } }
    ];
    const breakdownData = await MealRecord.aggregate(aggregationPipeline);
    res.status(200).json({ success: true, data: breakdownData });
});

module.exports = {
    getPerformanceSummary,
    getProgramBreakdown,
};