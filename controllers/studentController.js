// controllers/studentController.js

const mongoose = require('mongoose');
const Student = require('../models/StudentModel');
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');

// --- Controller Functions ---

// @desc    Add a new student
// @route   POST /api/v1/students
// @access  Private (Admin Only)
const addStudent = asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        return next(new Error(errors.array().map(err => err.msg).join(', ')));
    }

    const { studentIdNumber, name, program, yearLevel, section, profilePictureUrl } = req.body;
    const studentExists = await Student.findOne({ studentIdNumber: studentIdNumber.trim() });

    if (studentExists) {
        res.status(400);
        return next(new Error(`Student with ID ${studentIdNumber} already exists.`));
    }

    if (program.toUpperCase() === 'ACT' && parseInt(yearLevel, 10) > 2) {
        res.status(400);
        return next(new Error('ACT program is only available for Year 1 and 2.'));
    }

    const student = new Student({
        studentIdNumber: studentIdNumber.trim(),
        name: name.trim(),
        program: program.trim().toUpperCase(),
        yearLevel: parseInt(yearLevel, 10),
        section: section ? section.trim().toUpperCase() : undefined,
        profilePictureUrl: profilePictureUrl ? profilePictureUrl.trim() : undefined,
    });

    const createdStudent = await student.save();

    res.status(201).json({
        success: true,
        message: 'Student added successfully',
        data: createdStudent,
    });
});


// @desc    Get all students with filtering, sorting, pagination, and search
// @route   GET /api/v1/students
// @access  Private (Admin Only)
const getStudents = asyncHandler(async (req, res, next) => {
    // --- Filtering ---
    let query = {}; // Mongoose query object
    if (req.query.program) {
        query.program = req.query.program.toUpperCase();
    }
    if (req.query.yearLevel) {
        const year = parseInt(req.query.yearLevel, 10);
        if (!isNaN(year)) {
            query.yearLevel = year;
        }
    }
    if (req.query.section) {
        query.section = req.query.section.toUpperCase();
    }

    // --- Searching ---
    // Search by name (case-insensitive) or studentIdNumber
    if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i'); // 'i' for case-insensitive
        query.$or = [ // Use $or to match either name or studentIdNumber
            { name: searchRegex },
            { studentIdNumber: searchRegex }
        ];
    }

    // --- Sorting ---
    let sort = {}; // Mongoose sort object
    if (req.query.sortBy) {
        const order = req.query.order === 'desc' ? -1 : 1; // Default to ascending (1)
        sort[req.query.sortBy] = order;
    } else {
        sort.name = 1; // Default sort by name ascending
    }

    // --- Pagination ---
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit; // Not directly used in query, but useful for metadata

    // --- Database Query ---
    // Get total count matching the filter/search criteria for pagination metadata
    const total = await Student.countDocuments(query);

    // Execute the main query with filter, search, sort, and pagination
    const students = await Student.find(query)
        .sort(sort)
        .skip(startIndex)
        .limit(limit);

    // --- Pagination Metadata ---
    const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
        totalItems: total,
    };
    // Add next/prev page info (optional, but helpful for frontend)
    if (endIndex < total) {
        pagination.next = {
            page: page + 1,
            limit,
        };
    }
    if (startIndex > 0) {
        pagination.prev = {
            page: page - 1,
            limit,
        };
    }

    // --- Response ---
    res.status(200).json({
        success: true,
        count: students.length, // Number of items on the current page
        pagination,
        data: students,
    });
});



// @desc    Get single student by ID
// @route   GET /api/v1/students/:id
// @access  Private (Admin Only)
const getStudentById = asyncHandler(async (req, res, next) => {
    // Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400); // Bad Request for invalid ID format
        return next(new Error(`Invalid student ID format: ${req.params.id}`));
    }

    // Find the student by the ID provided in the URL parameters
    const student = await Student.findById(req.params.id);

    // Check if a student was found
    if (student) {
        res.status(200).json({
            success: true,
            data: student,
        });
    } else {
        // If no student found for that ID, return 404 Not Found
        res.status(404);
        return next(new Error(`Student not found with ID: ${req.params.id}`));
    }
});

// @desc    Update a student by ID
// @route   PUT /api/v1/students/:id
// @access  Private (Admin Only)
const updateStudent = asyncHandler(async (req, res, next) => {
    // 1. Check for validation errors from express-validator middleware
    // (Validation rules will be applied in the route definition)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        // Join error messages if multiple, or take the first one
        const errorMessages = errors.array().map(err => err.msg).join(', ');
        return next(new Error(errorMessages || 'Validation failed'));
    }

    // 2. Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error(`Invalid student ID format: ${req.params.id}`));
    }

    // 3. Find the student by ID
    let student = await Student.findById(req.params.id);

    // 4. Check if student exists
    if (!student) {
        res.status(404);
        return next(new Error(`Student not found with ID: ${req.params.id}`));
    }

    // 5. Extract updated data from request body
    const { studentIdNumber, name, program, yearLevel, section, profilePictureUrl } = req.body;

    // 6. Check for potential Student ID Number conflict (if changed)
    // Only check if studentIdNumber is provided in the body AND it's different from the current one
    if (studentIdNumber && studentIdNumber.trim() !== student.studentIdNumber) {
        const existingStudentWithNewId = await Student.findOne({
             studentIdNumber: studentIdNumber.trim(),
             _id: { $ne: req.params.id } // Exclude the current student document
        });
        if (existingStudentWithNewId) {
            res.status(400); // Or 409 Conflict
            return next(new Error(`Student ID ${studentIdNumber.trim()} is already assigned to another student.`));
        }
        student.studentIdNumber = studentIdNumber.trim();
    }

    // 7. Validate ACT program year level restriction if program or yearLevel is being updated
    // Determine what the new program/yearLevel would be if updated
    const newProgram = (program !== undefined) ? program.trim().toUpperCase() : student.program;
    const newYearLevel = (yearLevel !== undefined) ? parseInt(yearLevel, 10) : student.yearLevel;

    if (newProgram === 'ACT' && newYearLevel > 2) {
        res.status(400);
        return next(new Error('ACT program is only available for Year 1 and 2.'));
    }

    // 8. Update student fields (only update fields that are provided in the request body)
    if (name !== undefined) student.name = name.trim();
    if (program !== undefined) student.program = newProgram; // Use the validated newProgram
    if (yearLevel !== undefined) student.yearLevel = newYearLevel; // Use the validated newYearLevel

    // For optional fields, allow them to be explicitly set to null or empty to effectively clear them,
    // or update them if a new value is provided.
    if (section !== undefined) { // If section is part of the request body
        student.section = (section === null || String(section).trim() === '') ? undefined : String(section).trim().toUpperCase();
    }
    if (profilePictureUrl !== undefined) { // If profilePictureUrl is part of the request body
        student.profilePictureUrl = (profilePictureUrl === null || String(profilePictureUrl).trim() === '') ? undefined : String(profilePictureUrl).trim();
    }


    // 9. Save the updated student document
    const updatedStudent = await student.save();

    // 10. Send success response
    res.status(200).json({ // 200 OK for successful update
        success: true,
        message: 'Student updated successfully',
        data: updatedStudent,
    });
});


// @desc    Delete a student by ID
// @route   DELETE /api/v1/students/:id
// @access  Private (Admin Only)
const deleteStudent = asyncHandler(async (req, res, next) => {
    // 1. Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400); // Bad Request for invalid ID format
        return next(new Error(`Invalid student ID format: ${req.params.id}`));
    }

    // 2. Find the student by ID
    const student = await Student.findById(req.params.id);

    // 3. Check if student exists
    if (!student) {
        res.status(404);
        return next(new Error(`Student not found with ID: ${req.params.id}`));
    }

    // 4. Delete the student document
    // You can use student.deleteOne() if you already fetched the document,
    // or Student.findByIdAndDelete(req.params.id) to find and delete in one operation.
    await student.deleteOne();
    // OR: await Student.findByIdAndDelete(req.params.id); // This also works

    // 5. Send success response
    // HTTP 200 OK with a message or HTTP 204 No Content (typically with an empty body) are common for DELETE.
    // Let's use 200 OK with a message for clarity.
    res.status(200).json({
        success: true,
        message: `Student with ID ${req.params.id} deleted successfully.`,
        data: {}, // Often, no data is returned on delete, or the deleted object can be returned.
    });
});

// --- Export Controller Functions ---
module.exports = {
    addStudent,
    getStudents,
    getStudentById,
    updateStudent,
    deleteStudent
};