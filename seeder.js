const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const colors = require('colors');
const dotenv = require('dotenv');

dotenv.config();

// Load models
const Admin = require('./models/AdminModel');
const Program = require('./models/ProgramModel');
const Student = require('./models/StudentModel');
const Schedule = require('./models/ScheduleModel');
const MealRecord = require('./models/MealRecordModel');

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {});

// Read JSON files
const admins = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'admins.json'), 'utf-8'));
const programs = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'programs.json'), 'utf-8'));
const students = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'students.json'), 'utf-8'));
const scheduleTemplates = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'schedules.json'), 'utf-8'));

const getDayOfWeekString = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getUTCDay()];
};

const importData = async () => {
    try {
        console.log('--- Deleting existing data... ---'.cyan);
        await MealRecord.deleteMany();
        await Schedule.deleteMany();
        await Student.deleteMany();
        await Program.deleteMany();
        await Admin.deleteMany();
        console.log('--- Existing data deleted. ---'.green);

        console.log('--- Seeding new data... ---'.cyan);

        await Admin.create(admins);
        await Program.create(programs);
        console.log('Admins & Programs Imported...'.green);

        const seededStudents = await Student.create(students);
        console.log('Students Imported...'.green);

        const schedulesToCreate = [];
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        for (const template of scheduleTemplates) {
            for (const day of allDays) {
                schedulesToCreate.push({
                    program: template.program,
                    yearLevel: template.yearLevel,
                    dayOfWeek: day,
                    isEligible: template.eligibleDays.includes(day),
                });
            }
        }
        await Schedule.create(schedulesToCreate);
        console.log('Schedules Imported...'.green);

        const mealRecordsToCreate = [];
        const BATCH_SIZE = 1000;

        console.log('Generating historical meal records for the last 90 days...'.cyan);
        const allSchedules = await Schedule.find({ isEligible: true }).lean(); // use lean to reduce memory use
        const today = new Date();

        for (let i = 0; i < 180; i++) {
            const currentDate = new Date(today);
            currentDate.setUTCDate(currentDate.getUTCDate() - i);
            currentDate.setUTCHours(12, 0, 0, 0);

            const dayOfWeek = getDayOfWeekString(currentDate);
            if (dayOfWeek === 'Sunday') continue;

            const dailyClaimRate = Math.random() * (0.95 - 0.80) + 0.80;

            // Filter once per day (cheaper than per student)
            const schedulesForThisDay = new Map();
            allSchedules
                .filter(s => s.dayOfWeek === dayOfWeek)
                .forEach(s => schedulesForThisDay.set(`${s.program}-${s.yearLevel}`, true));

            if (schedulesForThisDay.size === 0) continue;

            let mealRecordsBatch = [];

            for (const student of seededStudents) {
                const key = `${student.program}-${student.yearLevel}`;
                if (!schedulesForThisDay.has(key)) continue;

                const status = Math.random() < dailyClaimRate ? 'CLAIMED' : 'ELIGIBLE_BUT_NOT_CLAIMED';

                mealRecordsBatch.push({
                    student: student._id,
                    studentIdNumber: student.studentIdNumber,
                    programAtTimeOfRecord: student.program,
                    yearLevelAtTimeOfRecord: student.yearLevel,
                    dateChecked: currentDate,
                    status: status,
                });

                // If batch size is reached, insert and reset
                if (mealRecordsBatch.length >= BATCH_SIZE) {
                    await MealRecord.insertMany(mealRecordsBatch);
                    mealRecordsBatch = [];
                }
            }

            // Insert any leftover batch
            if (mealRecordsBatch.length > 0) {
                await MealRecord.insertMany(mealRecordsBatch);
            }

            console.log(`✔ Day ${i + 1}/180 processed.`);
        }


        if (mealRecordsToCreate.length > 0) {
            await MealRecord.create(mealRecordsToCreate);
            console.log(`${mealRecordsToCreate.length} historical meal records (claimed and unclaimed) created.`.green);
        } else {
            console.log('No historical meal records were generated.'.yellow);
        }

        console.log('--- Data Import Complete ---'.green.bold);
        process.exit();
    } catch (err) {
        console.error(`${err}`.red.bold);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await MealRecord.deleteMany();
        await Schedule.deleteMany();
        await Student.deleteMany();
        await Program.deleteMany();
        await Admin.deleteMany();
        console.log('Data Destroyed!'.red.bold);
        process.exit();
    } catch (err) {
        console.error(`${err}`.red.bold);
        process.exit(1);
    }
};

if (process.argv[2] === '-i') {
    importData();
} else if (process.argv[2] === '-d') {
    destroyData();
} else {
    console.log('Please use the -i flag to import data or -d to destroy data.'.yellow);
    process.exit();
}