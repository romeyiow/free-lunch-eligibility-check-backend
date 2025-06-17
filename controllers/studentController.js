const mongoose = require('mongoose');
const Student = require('../models/StudentModel');
const Program = require('../models/ProgramModel'); // <-- Import Program model
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');

// Helper function for program validation
const validateProgramExists = async (programName) => {
    const program = await Program.findOne({ name: programName.toUpperCase() });
    if (!program) {
        throw new Error(`Program '${programName.toUpperCase()}' does not exist in the database.`);
    }
    return true;
};


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
    
    // Dynamic Program Validation
    await validateProgramExists(program);

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
    let query = {};
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

    if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        query.$or = [
            { name: searchRegex },
            { studentIdNumber: searchRegex }
        ];
    }

    let sortOptions = {};
    const { sortBy, order } = req.query;

    if (sortBy) {
        const allowedSortKeys = ['name', 'program', 'yearLevel', 'studentIdNumber', 'createdAt', 'updatedAt'];
        if (allowedSortKeys.includes(sortBy)) {
            sortOptions[sortBy] = (order === 'desc' || order === -1 || order === '-1') ? -1 : 1;
        } else {
            sortOptions.name = 1;
        }
    } else {
        sortOptions.name = 1;
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
        .sort(sortOptions)
        .skip(startIndex)
        .limit(limit);

    const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
        totalItems: total,
    };
    if (endIndex < total) {
        pagination.next = { page: page + 1, limit };
    }
    if (startIndex > 0) {
        pagination.prev = { page: page - 1, limit };
    }

    res.status(200).json({
        success: true,
        count: students.length,
        pagination,
        data: students,
    });
});


// @desc    Get single student by ID
// @route   GET /api/v1/students/:id
// @access  Private (Admin Only)
const getStudentById = asyncHandler(async (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error(`Invalid student ID format: ${req.params.id}`));
    }

    const student = await Student.findById(req.params.id);

    if (student) {
        res.status(200).json({
            success: true,
            data: student,
        });
    } else {
        res.status(404);
        return next(new Error(`Student not found with ID: ${req.params.id}`));
    }
});

// @desc    Update a student by ID
// @route   PUT /api/v1/students/:id
// @access  Private (Admin Only)
const updateStudent = asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        const errorMessages = errors.array().map(err => err.msg).join(', ');
        return next(new Error(errorMessages || 'Validation failed'));
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error(`Invalid student ID format: ${req.params.id}`));
    }

    let student = await Student.findById(req.params.id);

    if (!student) {
        res.status(404);
        return next(new Error(`Student not found with ID: ${req.params.id}`));
    }

    const { studentIdNumber, name, program, yearLevel, section, profilePictureUrl } = req.body;

    if (studentIdNumber && studentIdNumber.trim() !== student.studentIdNumber) {
        const existingStudentWithNewId = await Student.findOne({
            studentIdNumber: studentIdNumber.trim(),
            _id: { $ne: req.params.id }
        });
        if (existingStudentWithNewId) {
            res.status(400);
            return next(new Error(`Student ID ${studentIdNumber.trim()} is already assigned to another student.`));
        }
        student.studentIdNumber = studentIdNumber.trim();
    }
    
    // Dynamic Program Validation
    if (program) {
        await validateProgramExists(program);
    }

    const newProgram = (program !== undefined) ? program.trim().toUpperCase() : student.program;
    const newYearLevel = (yearLevel !== undefined) ? parseInt(yearLevel, 10) : student.yearLevel;

    if (newProgram === 'ACT' && newYearLevel > 2) {
        res.status(400);
        return next(new Error('ACT program is only available for Year 1 and 2.'));
    }

    if (name !== undefined) student.name = name.trim();
    if (program !== undefined) student.program = newProgram;
    if (yearLevel !== undefined) student.yearLevel = newYearLevel;
    if (section !== undefined) {
        student.section = (section === null || String(section).trim() === '') ? undefined : String(section).trim().toUpperCase();
    }
    if (profilePictureUrl !== undefined) {
        student.profilePictureUrl = (profilePictureUrl === null || String(profilePictureUrl).trim() === '') ? undefined : String(profilePictureUrl).trim();
    }

    const updatedStudent = await student.save();

    res.status(200).json({
        success: true,
        message: 'Student updated successfully',
        data: updatedStudent,
    });
});


// @desc    Delete a student by ID
// @route   DELETE /api/v1/students/:id
// @access  Private (Admin Only)
const deleteStudent = asyncHandler(async (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error(`Invalid student ID format: ${req.params.id}`));
    }

    const student = await Student.findById(req.params.id);

    if (!student) {
        res.status(404);
        return next(new Error(`Student not found with ID: ${req.params.id}`));
    }

    await student.deleteOne();

    res.status(200).json({
        success: true,
        message: `Student with ID ${req.params.id} deleted successfully.`,
        data: {},
    });
});


module.exports = {
    addStudent,
    getStudents,
    getStudentById,
    updateStudent,
    deleteStudent
};