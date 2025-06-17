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

// Read JSON files for initial seeding
const admins = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'admins.json'), 'utf-8'));
const programs = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'programs.json'), 'utf-8'));
const students = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'students.json'), 'utf-8'));
const scheduleTemplates = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'schedules.json'), 'utf-8'));

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

        // Step 1: Seed Admins, Programs, and Schedules
        await Admin.create(admins);
        await Program.create(programs);
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
        console.log('Admins, Programs, & Schedules Imported...'.green);

        // Step 2: Seed Students and create a lookup map of their REAL database IDs
        const seededStudents = await Student.create(students);
        const studentMap = new Map();
        seededStudents.forEach(s => studentMap.set(s.studentIdNumber, s._id));
        console.log('Students Imported and lookup map created...'.green);

        // Step 3: Read the VERIFIED meal history file
        console.log('Reading verified meal_history.json file...'.cyan);
        const mealHistoryToSeed = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'meal_history.json'), 'utf-8'));
        
        // Step 4: Map the history to the real student IDs and prepare for insertion
        const mealRecordsToInsert = mealHistoryToSeed.map(record => {
            const studentDbId = studentMap.get(record.student._id); 
            if (!studentDbId) {
                console.warn(`Warning: Student ID ${record.student._id} from JSON not found in DB. Skipping record.`);
                return null;
            }
            return {
                student: studentDbId, // Use the actual MongoDB _id
                studentIdNumber: record.student._id,
                programAtTimeOfRecord: record.student.program,
                yearLevelAtTimeOfRecord: record.student.yearLevel,
                dateChecked: new Date(record.dateChecked),
                status: record.status,
            };
        }).filter(Boolean); // Filter out any records that couldn't be matched

        if (mealRecordsToInsert.length > 0) {
            await MealRecord.insertMany(mealRecordsToInsert);
            console.log(`Successfully imported ${mealRecordsToInsert.length} records from meal_history.json`.green);
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