const fs = require('fs');
const path = require('path');
const colors = require('colors');

function generateHistory() {
    try {
        console.log('Reading source data files...'.cyan);
        const students = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'students.json'), 'utf-8'));
        const scheduleTemplates = JSON.parse(fs.readFileSync(path.join(__dirname, '_data', 'schedules.json'), 'utf-8'));

        // Pre-process schedules into a fast lookup map for efficiency
        const scheduleMap = new Map();
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        for (const day of allDays) {
            const eligibleForDay = new Set();
            scheduleTemplates.forEach(template => {
                if (template.eligibleDays.includes(day)) {
                    eligibleForDay.add(`${template.program}-${template.yearLevel}`);
                }
            });
            scheduleMap.set(day, eligibleForDay);
        }
        console.log('Schedule lookup map created.'.green);

        console.log('Generating sparse meal history for the last 180 days...'.cyan);
        const allRecords = [];
        const today = new Date();

        for (let i = 0; i < 180; i++) {
            const currentDate = new Date();
            currentDate.setUTCHours(12, 0, 0, 0); // Use midday for consistency
            currentDate.setUTCDate(currentDate.getUTCDate() - i);
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getUTCDay()];

            if (dayOfWeek === 'Sunday') continue;

            const eligibleSetForDay = scheduleMap.get(dayOfWeek);
            if (!eligibleSetForDay) continue;

            // Filter to get only students who are eligible on this specific day
            const eligibleStudents = students.filter(student =>
                eligibleSetForDay.has(`${student.program}-${student.yearLevel}`)
            );

            // For this smaller group of eligible students, create claim/unclaim records
            for (const student of eligibleStudents) {
                const status = (Math.random() < 0.9) ? 'CLAIMED' : 'ELIGIBLE_BUT_NOT_CLAIMED';
                
                // This structure mimics the hardcoded file and what the frontend expects
                allRecords.push({
                    student: {
                        _id: student.studentIdNumber, // Use a unique value like ID for later mapping
                        name: student.name,
                        program: student.program,
                        yearLevel: student.yearLevel,
                    },
                    dateChecked: currentDate.toISOString(),
                    status: status,
                });
            }
        }

        const outputPath = path.join(__dirname, '_data', 'meal_history.json');
        fs.writeFileSync(outputPath, JSON.stringify(allRecords, null, 2), 'utf-8');
        console.log(`\nSuccessfully generated ${allRecords.length} records and saved to ${outputPath}`.green.bold);

    } catch (error) {
        console.error('An error occurred:'.red.bold, error);
    }
}

generateHistory();