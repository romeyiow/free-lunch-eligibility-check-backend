const MealRecord = require('../models/MealRecordModel');
const Student = require('../models/StudentModel');
const Schedule = require('../models/ScheduleModel');
const asyncHandler = require('express-async-handler');

// --- HIGH-PERFORMANCE PRE-CALCULATION ---

let precalculatedAllotments = null;

// This function runs once when the module is first loaded.
const precalculateAllottedMeals = async () => {
    try {
        console.log('Pre-calculating daily allotted meal counts...'.yellow);
        const schedules = await Schedule.find({ isEligible: true }).lean();
        const pipeline = [
            { $group: { _id: { program: '$program', yearLevel: '$yearLevel' }, count: { $sum: 1 } } }
        ];
        const studentCounts = await Student.aggregate(pipeline);
        
        const countsByCohort = new Map();
        studentCounts.forEach(item => {
            countsByCohort.set(`${item._id.program}-${item._id.yearLevel}`, item.count);
        });

        const dailyTotals = {
            Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
        };

        schedules.forEach(schedule => {
            const count = countsByCohort.get(`${schedule.program}-${schedule.yearLevel}`) || 0;
            dailyTotals[schedule.dayOfWeek] += count;
        });
        
        precalculatedAllotments = dailyTotals;
        console.log('Allotted meal counts pre-calculated successfully:'.green, precalculatedAllotments);
    } catch (error) {
        console.error('Failed to pre-calculate allotted meals:'.red, error);
        // If this fails, the app can still run, but allotted numbers will be 0.
        precalculatedAllotments = null;
    }
};

// Immediately invoke the pre-calculation when the server starts.
precalculateAllottedMeals();


// This function now specifically calculates claimed/unclaimed from records
const calculateClaimSummaryForPeriod = async (startDate, endDate) => {
    // This function remains the same
    const aggregationResult = await MealRecord.aggregate([
        { $match: { dateChecked: { $gte: startDate, $lte: endDate }, status: { $in: ['CLAIMED', 'ELIGIBLE_BUT_NOT_CLAIMED'] } } },
        { $group: { _id: null, claimed: { $sum: { $cond: [{ $eq: ['$status', 'CLAIMED'] }, 1, 0] } }, unclaimed: { $sum: { $cond: [{ $eq: ['$status', 'ELIGIBLE_BUT_NOT_CLAIMED'] }, 1, 0] } } } },
        { $project: { _id: 0, claimed: 1, unclaimed: 1 } }
    ]);
    return aggregationResult[0] || { claimed: 0, unclaimed: 0 };
};


// Helper to get a date range. (This function remains unchanged)
const getPeriodRange = (periodType, value) => {
    // ... (This function's content is identical to the previous version and does not need to be copied again if it's already correct)
    let startDate, endDate;
    const now = new Date();
    switch (periodType.toLowerCase()) {
        case 'daily': {
            const targetDate = value ? new Date(value) : now;
            startDate = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
            endDate = new Date(startDate);
            endDate.setUTCHours(23, 59, 59, 999);
            break;
        }
        case 'weekly': {
             const weekRefDate = value ? new Date(value) : now;
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
                year = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1;
            } else {
                year = now.getFullYear(); month = now.getMonth();
            }
            startDate = new Date(Date.UTC(year, month, 1));
            endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            break;
        }
        case 'semestral': {
            const academicYearStart = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
            if (value === '1st') {
                startDate = new Date(Date.UTC(academicYearStart, 8, 1));
                endDate = new Date(Date.UTC(academicYearStart + 1, 1, 0, 23, 59, 59, 999));
            } else {
                startDate = new Date(Date.UTC(academicYearStart + 1, 1, 1));
                endDate = new Date(Date.UTC(academicYearStart + 1, 7, 0, 23, 59, 59, 999));
            }
            break;
        }
        default: return { error: 'Invalid period type.' };
    }
    return { startDate, endDate, error: null };
};

const getPerformanceSummary = asyncHandler(async (req, res) => {
    const { filterPeriod } = req.query;
    let responseData = [];

    if (!precalculatedAllotments) {
        return res.status(503).json({ success: false, error: "Server is initializing allotment data, please try again shortly." });
    }

    const processPeriod = async (range, name, id) => {
        // --- INSTANT ALLOTTED CALCULATION ---
        let allotted = 0;
        for (let d = new Date(range.startDate); d <= range.endDate; d.setUTCDate(d.getUTCDate() + 1)) {
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
            allotted += precalculatedAllotments[dayOfWeek] || 0;
        }

        const summaryResult = await calculateClaimSummaryForPeriod(range.startDate, range.endDate);
        return { id, name, allotted, ...summaryResult };
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
                if (weekRange.startDate.getUTCMonth() !== monthRange.startDate.getUTCMonth()) break;
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

// The getProgramBreakdown function remains unchanged as it is already efficient.
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