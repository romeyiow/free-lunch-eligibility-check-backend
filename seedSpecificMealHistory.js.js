// seedSpecificMealHistory.js
const mongoose = require('mongoose');
const colors = require('colors');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker');

dotenv.config({ path: './.env' }); // Ensure .env is loaded

// Load Mongoose Models
const Student = require('./models/StudentModel');
const MealRecord = require('./models/MealRecordModel');
const Schedule = require('./models/ScheduleModel');

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('FATAL ERROR: MONGO_URI environment variable is not set.');
        }
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected for Seeding: ${conn.connection.host}`.cyan.underline);
    } catch (error) {
        console.error(`DB Connection Error: ${error.message}`.red.bold);
        process.exit(1);
    }
};

const DAYS_IN_MONTH = {
    April: 30,
    May: 31,
};
const TARGET_YEAR = 2025;
const MONTH_INDICES = { April: 3, May: 4 }; // 0-indexed (Jan=0)

const generateSpecificMealRecords = async (numStudentsToProcess = 50, monthsToProcess = ["April", "May"]) => {
    console.log(`Starting generation of specific meal records...`.blue);
    const mealRecords = [];

    const allStudents = await Student.find().select('_id name program yearLevel section studentIdNumber'); // Added studentIdNumber for denormalization as it's in your model
    const allSchedules = await Schedule.find();

    if (allStudents.length === 0) {
        console.error('No students found in DB. Cannot generate meal records.'.red.bold);
        return [];
    }
    if (allStudents.length < numStudentsToProcess) {
        console.warn(`Warning: Requested ${numStudentsToProcess} students, but only ${allStudents.length} found. Processing all available.`.yellow);
        numStudentsToProcess = allStudents.length;
    }
     if (allSchedules.length === 0) {
        console.warn('No schedules found in DB. Meal records might not accurately reflect eligibility for status.'.yellow);
    }


    const studentsForHistory = faker.helpers.arrayElements(allStudents, numStudentsToProcess);
    console.log(`Selected ${studentsForHistory.length} students for history generation.`.cyan);

    for (const student of studentsForHistory) {
        for (const monthName of monthsToProcess) {
            const monthIndex = MONTH_INDICES[monthName];
            const daysInThisMonth = DAYS_IN_MONTH[monthName];

            console.log(`Processing ${monthName} for student ${student.name || student.studentIdNumber}...`.gray);

            for (let day = 1; day <= daysInThisMonth; day++) {
                const recordDate = new Date(TARGET_YEAR, monthIndex, day, 12, 0, 0); // Midday
                const dayOfWeekName = recordDate.toLocaleDateString('en-US', { weekday: 'long' });

                if (dayOfWeekName === 'Sunday') {
                    continue; // Skip Sundays
                }

                let recordStatus = 'INELIGIBLE_NOT_SCHEDULED'; // Default

                const scheduleEntry = allSchedules.find(s =>
                    s.program === student.program &&
                    s.yearLevel === student.yearLevel &&
                    s.dayOfWeek === dayOfWeekName
                );

                if (scheduleEntry) {
                    if (scheduleEntry.isEligible) {
                        recordStatus = faker.datatype.boolean(0.75) ? 'CLAIMED' : 'ELIGIBLE_BUT_NOT_CLAIMED'; // 75% chance claimed
                    } else {
                        recordStatus = 'INELIGIBLE_NOT_SCHEDULED';
                    }
                } else {
                    recordStatus = 'INELIGIBLE_NOT_SCHEDULED';
                }
                
                const nameParts = student.name ? student.name.split(" ") : ["N/A", ""];
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(" ");

                mealRecords.push({
                    student: student._id,
                    studentIdNumber: student.studentIdNumber, // Keeping denormalized as per your model
                    denormalizedStudentName: student.name, 
                    denormalizedStudentFirstName: firstName, // For easier display if needed
                    denormalizedStudentLastName: lastName,   // For easier display if needed
                    programAtTimeOfRecord: student.program,
                    yearLevelAtTimeOfRecord: student.yearLevel,
                    sectionAtTimeOfRecord: student.section,
                    dateChecked: recordDate,
                    status: recordStatus,
                });
            }
        }
    }
    console.log(`Generated ${mealRecords.length} meal record entries.`.green);
    return mealRecords;
};

const seedHistory = async () => {
    await connectDB();
    try {
        // Optional: Clear existing meal records for April and May 2025 if you want to avoid duplicates on re-run
        // This is safer if you might run the script multiple times.
        const aprilStart = new Date(TARGET_YEAR, MONTH_INDICES.April, 1);
        const mayEnd = new Date(TARGET_YEAR, MONTH_INDICES.May + 1, 0, 23, 59, 59, 999); // End of May

        console.log(`Deleting existing meal records from ${aprilStart.toDateString()} to ${mayEnd.toDateString()}...`.yellow);
        const deleteResult = await MealRecord.deleteMany({
            dateChecked: { $gte: aprilStart, $lte: mayEnd }
        });
        console.log(`Deleted ${deleteResult.deletedCount} old records for April & May ${TARGET_YEAR}.`.yellow);


        const mealRecordSeedData = await generateSpecificMealRecords(50, ["April", "May"]);

        if (mealRecordSeedData.length > 0) {
            console.log(`Inserting ${mealRecordSeedData.length} new meal records...`.blue);
            await MealRecord.insertMany(mealRecordSeedData, { ordered: false, rawResult: false }); // insertMany is faster for bulk
            console.log(`Successfully inserted specific meal history for April & May ${TARGET_YEAR}!`.green.inverse);
        } else {
            console.log('No meal records were generated by the script.'.yellow);
        }
        process.exit(0);
    } catch (err) {
        console.error(`Specific Meal History Seeding Error: ${err.message}`.red.inverse);
        console.error(err.stack);
        process.exit(1);
    }
};

seedHistory();