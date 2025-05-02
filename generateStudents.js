// generateStudents.js
const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker'); // Import faker

// Allowed programs and year restrictions
const ALLOWED_PROGRAMS = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];
const ACT_MAX_YEAR = 2;
const OTHER_MAX_YEAR = 4;
const SECTIONS = ['A', 'B', 'C', 'D'];

const students = [];
const numStudents = 100; // How many students to generate

// Basic unique ID generation
let idCounter = 1;
const currentYearPrefix = new Date().getFullYear();

console.log(`Generating ${numStudents} student records...`);

for (let i = 0; i < numStudents; i++) {
    let program;
    let yearLevel;
    let isValid = false;

    // Ensure generated program/year combo is valid
    while (!isValid) {
        program = ALLOWED_PROGRAMS[Math.floor(Math.random() * ALLOWED_PROGRAMS.length)];
        const maxYear = program === 'ACT' ? ACT_MAX_YEAR : OTHER_MAX_YEAR;
        yearLevel = Math.floor(Math.random() * maxYear) + 1;
        isValid = true;
    }

    const studentIdNumber = `${currentYearPrefix}-${String(idCounter++).padStart(4, '0')}-FAK`; // Added FAK suffix

    // Use Faker for realistic names
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const section = SECTIONS[Math.floor(Math.random() * SECTIONS.length)];
    // Use a consistent default or a faker image if preferred
    const profilePictureUrl = `/images/default-avatar.png`;
    // const profilePictureUrl = faker.image.avatarGitHub(); // Alternative

    students.push({
        studentIdNumber,
        name: `${firstName} ${lastName}`,
        program,
        yearLevel,
        section,
        profilePictureUrl,
    });
}

// Path to the output file
const outputPath = path.join(__dirname, '_data', 'students.json');

// Write the generated data to the file
try {
    // Ensure the _data directory exists
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath));
    }
    // Write the file, pretty-printing the JSON
    fs.writeFileSync(outputPath, JSON.stringify(students, null, 2), 'utf-8');
    console.log(`Successfully generated ${numStudents} students with realistic names to ${outputPath}`);
} catch (err) {
    console.error('Error writing students data file:', err);
}