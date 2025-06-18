const MealRecord = require('../models/MealRecordModel');
const Student = require('../models/StudentModel');
const Schedule = require('../models/ScheduleModel');
const asyncHandler = require('express-async-handler');

// --- NEW HELPER FUNCTION TO CALCULATE TRUE ALLOTTED MEALS ---
const calculateAllottedForPeriod = async (startDate, endDate) => {
    let totalAllotted = 0;
    
    // Get all relevant schedules once to avoid querying in a loop
    const schedules = await Schedule.find({ isEligible: true }).lean();
    const scheduleByDay = schedules.reduce((acc, s) => {
        if (!acc[s.dayOfWeek]) {
            acc[s.dayOfWeek] = [];
        }
        acc[s.dayOfWeek].push({ program: s.program, yearLevel: s.yearLevel });
        return acc;
    }, {});

    // Iterate through each day in the provided range
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
        
        const eligibleCohorts = scheduleByDay[dayOfWeek];
        
        if (eligibleCohorts && eligibleCohorts.length > 0) {
            // Count students who match the eligible program/year combinations for this specific day
            const dailyCount = await Student.countDocuments({ $or: eligibleCohorts });
            totalAllotted += dailyCount;
        }
    }
    
    return { allotted: totalAllotted };
};

// This function now specifically calculates claimed/unclaimed from records
const calculateClaimSummaryForPeriod = async (startDate, endDate) => {
    const aggregationResult = await MealRecord.aggregate([
        { $match: { dateChecked: { $gte: startDate, $lte: endDate }, status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] } } },
        { $group: { _id: null, claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } }, unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } } } },
        { $project: { _id: 0, claimed: 1, unclaimed: 1 } }
    ]);
    return aggregationResult[0] || { claimed: 0, unclaimed: 0 };
};


// Helper to get a date range. (This function remains unchanged)
const getPeriodRange = (periodType, value) => {
    let startDate, endDate;
    const now = new Date();
    
    switch (periodType.toLowerCase()) {
        case 'daily': {
            const targetDate = value ? new Date(value) : now;
            if (isNaN(targetDate.getTime())) return { error: 'Invalid date. Use YYYY-MM-DD.' };
            startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
            endDate = new Date(startDate);
            endDate.setUTCHours(23, 59, 59, 999);
            break;
        }
        case 'weekly': {
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
        case 'monthly': {
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
        case 'semestral': {
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

const getPerformanceSummary = asyncHandler(async (req, res) => {
    const { filterPeriod } = req.query;
    let responseData = [];

    const processPeriod = async (range, name, id) => {
        const [allottedResult, summaryResult] = await Promise.all([
            calculateAllottedForPeriod(range.startDate, range.endDate),
            calculateClaimSummaryForPeriod(range.startDate, range.endDate)
        ]);
        return { id, name, ...allottedResult, ...summaryResult };
    };

    switch (filterPeriod.toLowerCase()) {
        case 'daily': {
            const weekRange = getPeriodRange('weekly');
            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            for (let i = 0; i < 7; i++) {
                const currentDay = new Date(weekRange.startDate);
                currentDay.setUTCDate(currentDay.getUTCDate() + i);
                const dayRange = getPeriodRange('daily', currentDay.toISOString());
                const summary = await processPeriod(dayRange, days[i], currentDay.toISOString().split('T')[0]);
                responseData.push(summary);
            }
            break;
        }
        case 'weekly': {
            const monthRange = getPeriodRange('monthly');
            let weekStart = new Date(monthRange.startDate);
            let weekCounter = 1;
            while (weekStart <= monthRange.endDate) {
                const weekRange = getPeriodRange('weekly', weekStart.toISOString());
                if (weekRange.startDate.getUTCMonth() !== monthRange.startDate.getUTCMonth()) break; // Ensure weeks are within the month
                const summary = await processPeriod(weekRange, `Week ${weekCounter}`, weekRange.startDate.toISOString().split('T')[0]);
                responseData.push(summary);
                weekStart.setUTCDate(weekStart.getUTCDate() + 7);
                weekCounter++;
            }
            break;
        }
        case 'monthly': {
            const year = new Date().getFullYear();
            for (let m = 0; m < 12; m++) {
                const monthRange = getPeriodRange('monthly', `${year}-${m + 1}`);
                const monthName = new Date(Date.UTC(year, m)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
                const summary = await processPeriod(monthRange, monthName, `${year}-${m+1}`);
                responseData.push(summary);
            }
            break;
        }
        case 'semestral': {
            const sem1Range = getPeriodRange('semestral', '1st');
            const sem2Range = getPeriodRange('semestral', '2nd');
            const [sem1Summary, sem2Summary] = await Promise.all([
                processPeriod(sem1Range, '1st Semester', '1st'),
                processPeriod(sem2Range, '2nd Semester', '2nd')
            ]);
            responseData.push(sem1Summary, sem2Summary);
            break;
        }
        default:
            return res.status(400).json({ success: false, error: "Invalid filter period for summary." });
    }
    res.status(200).json({ success: true, data: responseData });
});

const getProgramBreakdown = asyncHandler(async (req, res) => {
    // This function remains unchanged as it calculates based on actual records
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