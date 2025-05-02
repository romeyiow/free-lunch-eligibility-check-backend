// controllers/studentController.js
const Student = require('../models/StudentModel'); // Import the Student model
// const asyncHandler = require('../middleware/asyncHandler'); // Import asyncHandler
const asyncHandler = require('express-async-handler'); // Import asyncHandler
const { body, validationResult } = require('express-validator'); // Import validation tools

// --- Controller Functions ---

// @desc    Add a new student
// @route   POST /api/v1/students
// @access  Private (Admin Only)
// We wrap async functions with asyncHandler to avoid repetitive try...catch blocks
const addStudent = asyncHandler(async (req, res, next) => {
    // 1. Check for validation errors from express-validator middleware
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // If errors exist, return 400 Bad Request with error details
        res.status(400);
        // Use next() to pass a structured error to the global errorHandler
        return next(new Error(errors.array().map(err => err.msg).join(', ')));
    }

    // 2. Extract student data from validated request body
    const { studentIdNumber, name, program, yearLevel, section, profilePictureUrl } = req.body;

    // 3. Check if student with the same ID Number already exists
    const studentExists = await Student.findOne({ studentIdNumber: studentIdNumber.trim() });

    if (studentExists) {
        res.status(400); // Bad Request or 409 Conflict could also be used
        return next(new Error(`Student with ID ${studentIdNumber} already exists.`));
    }

    // 4. (Deferred Complex Validation): Add check for ACT program year level restriction here later if needed
    // Example placeholder:
    if (program.toUpperCase() === 'ACT' && parseInt(yearLevel, 10) > 2) {
        res.status(400);
        return next(new Error('ACT program is only available for Year 1 and 2.'));
    }


    // 5. Create new student instance
    const student = new Student({
        studentIdNumber: studentIdNumber.trim(),
        name: name.trim(),
        program: program.trim().toUpperCase(),
        yearLevel: parseInt(yearLevel, 10),
        section: section ? section.trim().toUpperCase() : undefined, // Handle optional section
        profilePictureUrl: profilePictureUrl ? profilePictureUrl.trim() : undefined, // Handle optional picture URL
    });

    // 6. Save the new student to the database
    const createdStudent = await student.save();

    // 7. Send success response
    res.status(201).json({ // 201 Created status code is appropriate
        success: true,
        message: 'Student added successfully',
        data: createdStudent, // Return the created student data
    });
});

// --- Export Controller Functions ---
module.exports = {
    addStudent,
    // Add other student controller functions here later (getStudents, getStudentById, etc.)
};