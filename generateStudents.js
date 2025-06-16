const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

const programsFilePath = path.join(__dirname, '_data', 'programs.json');
let ALLOWED_PROGRAMS = [];
try {
    const programsData = fs.readFileSync(programsFilePath, 'utf-8');
    const programs = JSON.parse(programsData);
    ALLOWED_PROGRAMS = programs.map(p => p.name);
} catch (error) {
    console.error(`Error: Could not read or parse programs.json at ${programsFilePath}`.red.bold);
    process.exit(1);
}

const SECTIONS = ['A', 'B', 'C', 'D'];
const NUM_STUDENTS = 150;
const students = [];
const usedStudentNumbers = new Set();

console.log(`Generating ${NUM_STUDENTS} student records...`);

for (let i = 0; i < NUM_STUDENTS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    
    // --- THIS IS THE NEW LOGIC FOR EMAIL ---
    const emailName = (firstName + lastName).replace(/\s+/g, '').toLowerCase();
    const email = `${emailName}@student.laverdad.edu.ph`;
    // -----------------------------------------
    
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    const middleInitialOrRandom = faker.string.alpha(1).toUpperCase(); 
    const initials = `${firstInitial}${lastInitial}${middleInitialOrRandom}`;

    const program = faker.helpers.arrayElement(ALLOWED_PROGRAMS);
    let yearLevel;
    if (program === 'ACT') {
        yearLevel = faker.helpers.arrayElement([1, 2]);
    } else {
        yearLevel = faker.helpers.arrayElement([1, 2, 3, 4]);
    }
    const section = faker.helpers.arrayElement(SECTIONS);

    const yearPrefix = new Date().getFullYear().toString().slice(-2); 
    
    let serialNumberPart;
    do {
        serialNumberPart = faker.string.numeric(5);
    } while (usedStudentNumbers.has(serialNumberPart));
    usedStudentNumbers.add(serialNumberPart);

    const studentIdNumber = `${yearPrefix}-${serialNumberPart}${initials}`;

    students.push({
        studentIdNumber,
        name: fullName,
        email: email, // Add the email field
        program,
        yearLevel,
        section,
        profilePictureUrl: '/images/default-avatar.png',
    });
}

const outputPath = path.join(__dirname, '_data', 'students.json');
try {
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath));
    }
    fs.writeFileSync(outputPath, JSON.stringify(students, null, 2), 'utf-8');
    console.log(`Successfully generated ${NUM_STUDENTS} students to ${outputPath}`);
} catch (err) {
    console.error('Error writing students data file:', err);
}