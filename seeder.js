const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const colors = require('colors');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker'); // For generating meal record dates

dotenv.config();

// Load Mongoose Models
const Admin = require('./models/AdminModel');
const Student = require('./models/StudentModel');
const MealRecord = require('./models/MealRecordModel');
const Schedule = require('./models/ScheduleModel');


// Connect to MongoDB Database
const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('FATAL ERROR: MONGO_URI environment variable is not set.');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeder...'.green);
    } catch (error) {
        console.error(`Seeder DB Connection Error: ${error.message}`.red.bold);
        process.exit(1); // Exit if DB connection fails
    }
};

// --- Data for Seeding ---
let adminsData = [];
let studentsData = [];
// We will generate schedule and meal record data programmatically

try {
    adminsData = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'admins.json'), 'utf-8'));
    studentsData = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'students.json'), 'utf-8'));
} catch (err) {
    console.error(`Error reading base data files: ${err.message}`.red);
    process.exit(1);
}

const DAYS_OF_WEEK_SEED = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; // Exclude Sunday

// --- Generate Schedule Data ---
const generateScheduleData = () => {
    const schedules = [];
    const programs = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];
    
    programs.forEach(program => {
        const maxYear = (program === 'ACT') ? 2 : 4;
        for (let year = 1; year <= maxYear; year++) {
            DAYS_OF_WEEK_SEED.forEach(day => {
                schedules.push({
                    program: program,
                    yearLevel: year,
                    dayOfWeek: day,
                    isEligible: true, // Default: all are eligible on these days. Change if needed.
                });
            });
        }
    });
    return schedules;
};

// --- Generate Meal Record Data ---
// This is more complex as it should ideally respect schedules and student existence.
// For simplicity, we'll generate some random records.
// --- NEW Generate Meal Record Data (More Deliberate) ---
const generateMealRecordDataForSpecificStudents = async (numStudentsToProcess = 90, numMonths = 3) => {
    const mealRecords = [];
    // Fetch ALL students and ALL schedules once
    const allStudents = await Student.find().select('_id studentIdNumber name program yearLevel section');
    const allSchedules = await Schedule.find();

    if (allStudents.length === 0) {
        console.warn('No students found in DB to generate meal records for.'.yellow);
        return [];
    }
    if (allSchedules.length === 0) {
        console.warn('No schedules found in DB. Meal records might not accurately reflect eligibility.'.yellow);
    }

    // Select a subset of students to process (e.g., the first 90 or a random 90)
    const studentsToProcess = allStudents.slice(0, Math.min(numStudentsToProcess, allStudents.length));
    console.log(`Generating meal records for ${studentsToProcess.length} students over ${numMonths} months.`.blue);

    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - numMonths); // Go back N months
    startDate.setDate(1); // Start from the 1st of that month
    startDate.setHours(0, 0, 0, 0);

    for (const student of studentsToProcess) {
        // Iterate over each day in the last numMonths
        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d); // Create a new Date object for each iteration
            currentDate.setHours(12, 0, 0, 0); // Set to midday to avoid timezone issues with date comparisons

            const dayOfWeekName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

            // Skip Sundays
            if (dayOfWeekName === 'Sunday') {
                continue;
            }

            let recordStatus = 'INELIGIBLE_NOT_SCHEDULED'; // Default

            // Find if there's a schedule entry for this student, for this specific day of the week
            const scheduleEntry = allSchedules.find(s =>
                s.program === student.program &&
                s.yearLevel === student.yearLevel &&
                s.dayOfWeek === dayOfWeekName
            );

            if (scheduleEntry) {
                if (scheduleEntry.isEligible) {
                    // Student was scheduled and eligible
                    // Randomly decide if they claimed or not
                    recordStatus = faker.datatype.boolean(0.8) ? 'CLAIMED' : 'ELIGIBLE_BUT_NOT_CLAIMED'; // 80% chance of claimed
                } else {
                    // Student was scheduled but not eligible for that day (e.g. holiday marked in schedule)
                    recordStatus = 'INELIGIBLE_NOT_SCHEDULED';
                }
            } else {
                // No specific schedule entry found for this program/year/day combination
                // This implies they were not scheduled to be eligible.
                recordStatus = 'INELIGIBLE_NOT_SCHEDULED';
            }
            
            // Denormalize student name parts
            const nameParts = student.name ? student.name.split(" ") : ["N/A", ""];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(" ");

            mealRecords.push({
                student: student._id,
                studentIdNumber: student.studentIdNumber,
                // Store denormalized name parts for easier display in MealHistory if student doc is not populated deeply
                denormalizedStudentName: student.name, 
                denormalizedStudentFirstName: firstName,
                denormalizedStudentLastName: lastName,
                programAtTimeOfRecord: student.program,
                yearLevelAtTimeOfRecord: student.yearLevel,
                sectionAtTimeOfRecord: student.section, // Add section
                dateChecked: new Date(currentDate), // Use the specific date of the loop
                status: recordStatus,
            });
        }
    }
    return mealRecords;
};

// Import data into DB
const importData = async () => {
    await connectDB();
    try {
        console.log('Clearing existing data...'.yellow);
        await Admin.deleteMany();
        await Student.deleteMany();
        await Schedule.deleteMany();
        await MealRecord.deleteMany();
        console.log('Existing data cleared.'.yellow);

        console.log('Importing Admins and Students...'.blue);
        await Admin.create(adminsData);
        const createdStudents = await Student.create(studentsData);
        console.log(`${createdStudents.length} Students Imported!`.green);

        const scheduleSeedData = generateScheduleData();
        const createdSchedules = await Schedule.create(scheduleSeedData);
        console.log(`${createdSchedules.length} Schedule Entries Imported!`.green);

        if (createdStudents.length > 0 && createdSchedules.length > 0) {
            console.log('Generating Meal Records... This might take a moment.'.cyan);
            const mealRecordSeedData = await generateMealRecordDataForSpecificStudents(90, 3); // 90 students, 3 months
            if (mealRecordSeedData.length > 0) {
                await MealRecord.create(mealRecordSeedData);
                console.log(`${mealRecordSeedData.length} Meal Records Imported!`.green);
            } else {
                console.log('No meal records generated.'.yellow);
            }
        } else {
            console.log('Skipping meal record generation due to missing students or schedules.'.yellow);
        }
        
        console.log('Data Imported Successfully!'.green.inverse);
        process.exit(0);
    } catch (err) {
        console.error(`Data Import Error: ${err}`.red.inverse);
        console.error(err.stack); // Log full stack for better debugging
        process.exit(1);
    }
};

// Delete all data from DB
const deleteData = async () => {
    await connectDB();
    try {
        console.log('Destroying all data...'.red);
        await Admin.deleteMany();
        await Student.deleteMany();
        await Schedule.deleteMany();
        await MealRecord.deleteMany();
        console.log('Data Destroyed Successfully!'.red.inverse);
        process.exit(0);
    } catch (err) {
        console.error(`Data Destruction Error: ${err}`.red.inverse);
        process.exit(1);
    }
};

// Process command line arguments
if (process.argv[2] === '-i') {
    importData();
} else if (process.argv[2] === '-d') {
    deleteData();
}else {
    console.log('Usage: node seeder.js [-i | -d]'.yellow);
    console.log('  -i: Import data from _data/*.json files');
    console.log('  -d: Destroy all data in related collections');
    process.exit(0); // Exit gracefully if no valid flag provided
}