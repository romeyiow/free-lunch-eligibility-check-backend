// generateStudents.js
const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

const ALLOWED_PROGRAMS = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];
const SECTIONS = ['A', 'B', 'C', 'D']; // Can randomize or assign systematically
const NUM_STUDENTS = 150; // Generate more students

const students = [];
const usedStudentNumbers = new Set(); // To ensure unique student numbers within the XXX part

console.log(`Generating ${NUM_STUDENTS} student records...`);

for (let i = 0; i < NUM_STUDENTS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    
    // Generate initials (simple approach, can be improved for multiple last names)
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    // For a third initial, we could use a middle name if available, or a second letter of last name
    // For simplicity, let's use a random uppercase letter if no middle initial.
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

    // Generate student ID: "YY-XXXXXIIL" (YY-SerialNumberInitials)
    // YY - last two digits of current year for simplicity, or a fixed year range
    const yearPrefix = new Date().getFullYear().toString().slice(-2); 
    
    let serialNumberPart;
    do {
        serialNumberPart = faker.string.numeric(5); // 5-digit random serial
    } while (usedStudentNumbers.has(serialNumberPart)); // Ensure somewhat unique within the generated batch
    usedStudentNumbers.add(serialNumberPart);

    const studentIdNumber = `${yearPrefix}-${serialNumberPart}${initials}`;

    students.push({
        studentIdNumber,
        name: fullName,
        program,
        yearLevel,
        section,
        profilePictureUrl: '/images/default-avatar.png', // Default avatar
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