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

// --- Helper Functions ---

const getDayOfWeekString = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getUTCDay()];
};

// --- Main Seeder Functions ---

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
        
        // 1. Seed Admins and Programs
        await Admin.create(admins);
        const seededPrograms = await Program.create(programs);
        console.log('Admins & Programs Imported...'.green);
        
        // 2. Seed Students
        await Student.create(students);
        console.log('Students Imported...'.green);

        // 3. Process and Seed Schedules
        const schedulesToCreate = [];
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        for (const template of scheduleTemplates) {
            const programInfo = seededPrograms.find(p => p.name === template.program);
            if (!programInfo) continue;

            const yearLevels = template.program === 'ACT' ? [1, 2] : [1, 2, 3, 4];
            
            // This part of the logic now assumes the template applies to all year levels
            // The logic from your revised schedules.json is now primary
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

        // 4. Generate Historical Meal Records for the last 90 days
        console.log('Generating historical meal records...'.cyan);
        const allStudents = await Student.find();
        const mealRecordsToCreate = [];
        const today = new Date();
        
        for (let i = 0; i < 90; i++) { // Loop for the past 90 days
            const currentDate = new Date();
            currentDate.setUTCDate(today.getUTCDate() - i);
            currentDate.setUTCHours(12, 0, 0, 0); // Set to noon UTC for consistency
            
            const dayOfWeek = getDayOfWeekString(currentDate);

            // Find students eligible on this specific day
            const eligibleSchedules = await Schedule.find({ dayOfWeek: dayOfWeek, isEligible: true }).select('program yearLevel');
            const eligibleCriteria = eligibleSchedules.map(s => ({ program: s.program, yearLevel: s.yearLevel }));
            
            if (eligibleCriteria.length === 0) continue;

            const studentsEligibleToday = allStudents.filter(student => 
                eligibleCriteria.some(crit => crit.program === student.program && crit.yearLevel === student.yearLevel)
            );

            for (const student of studentsEligibleToday) {
                 // Randomly decide if the student claimed the meal (e.g., 80% chance)
                if (Math.random() < 0.8) {
                    mealRecordsToCreate.push({
                        student: student._id,
                        studentIdNumber: student.studentIdNumber,
                        programAtTimeOfRecord: student.program,
                        yearLevelAtTimeOfRecord: student.yearLevel,
                        dateChecked: currentDate,
                        status: 'CLAIMED',
                    });
                }
                 // We will use the POST /generate-unclaimed endpoint to create unclaimed records later.
            }
        }
        
        if (mealRecordsToCreate.length > 0) {
            await MealRecord.create(mealRecordsToCreate);
            console.log(`${mealRecordsToCreate.length} historical meal records created.`.green);
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