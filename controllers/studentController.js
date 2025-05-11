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

// --- Export Controller Functions ---
module.exports = {
    addStudent,
    getStudents,
    getStudentById, // Add this line
};