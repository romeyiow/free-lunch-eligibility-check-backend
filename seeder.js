// seeder.js
const fs = require('fs'); // Node.js File System module
const mongoose = require('mongoose');
const colors = require('colors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Load Mongoose Models
const Admin = require('./models/AdminModel');
const Student = require('./models/StudentModel');
// const Schedule = require('./models/ScheduleModel'); // Uncomment when created
// const MealRecord = require('./models/MealRecordModel'); // Uncomment when created

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

// Read JSON Data Files
let admins = [];
let students = [];
try {
    admins = JSON.parse(
        fs.readFileSync(`${__dirname}/_data/admins.json`, 'utf-8')
    );
    students = JSON.parse(
        fs.readFileSync(`${__dirname}/_data/students.json`, 'utf-8')
    );
    // Read other data files when created
} catch (err) {
    console.error(`Error reading data files: ${err.message}`.red);
    process.exit(1);
}


// Import data into DB
const importData = async () => {
    await connectDB(); // Ensure DB is connected before importing
    try {
        // Clear existing data first
        // Using deleteMany without arguments deletes all documents in the collection
        console.log('Clearing existing data...'.yellow);
        await Admin.deleteMany();
        await Student.deleteMany();
        // await Schedule.deleteMany(); // Uncomment when created
        // await MealRecord.deleteMany(); // Uncomment when created
        console.log('Existing data cleared.'.yellow);

        // Insert new data using the models
        // The 'save' middleware in AdminModel will automatically hash passwords
        console.log('Importing new data...'.blue);
        await Admin.create(admins);
        await Student.create(students);
        // await Schedule.create(schedules); // Uncomment when created
        // await MealRecord.create(mealRecords); // Uncomment when created

        console.log('Data Imported Successfully!'.green.inverse);
        process.exit(0); // Exit successfully
    } catch (err) {
        console.error(`Data Import Error: ${err}`.red.inverse);
        process.exit(1); // Exit with failure
    }
};

// Delete all data from DB
const deleteData = async () => {
    await connectDB(); // Ensure DB is connected before deleting
    try {
        console.log('Destroying all data...'.red);
        await Admin.deleteMany();
        await Student.deleteMany();
        // await Schedule.deleteMany(); // Uncomment when created
        // await MealRecord.deleteMany(); // Uncomment when created

        console.log('Data Destroyed Successfully!'.red.inverse);
        process.exit(0); // Exit successfully
    } catch (err) {
        console.error(`Data Destruction Error: ${err}`.red.inverse);
        process.exit(1); // Exit with failure
    }
};

// Process command line arguments
// process.argv[2] refers to the third item in the command line input
// e.g., node seeder.js -i  (process.argv[2] is '-i')
if (process.argv[2] === '-i') {
    importData();
} else if (process.argv[2] === '-d') {
    deleteData();
} else {
    console.log('Usage: node seeder.js [-i | -d]'.yellow);
    console.log('  -i: Import data from _data/*.json files');
    console.log('  -d: Destroy all data in related collections');
    process.exit(0); // Exit gracefully if no valid flag provided
}