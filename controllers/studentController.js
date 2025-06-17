const mongoose = require('mongoose');
const Student = require('../models/StudentModel');
const Program = require('../models/ProgramModel');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');

// Helper to generate email from name
const generateEmailFromName = (name) => {
    return name.replace(/\s+/g, '').toLowerCase() + '@student.laverdad.edu.ph';
};

const validateProgramExists = async (programName) => {
    const program = await Program.findOne({ name: programName.toUpperCase() });
    if (!program) throw new Error(`Program '${programName.toUpperCase()}' does not exist.`);
    return true;
};

const addStudent = asyncHandler(async (req, res, next) => {
    const { studentIdNumber, name, program, yearLevel, section } = req.body;
    let { email } = req.body; // Make email mutable

    if (!name || !studentIdNumber || !program || !yearLevel) {
        return next(new Error('Name, Student ID, Program, and Year Level are required fields.'));
    }
    
    // --- THIS IS THE FIX: Auto-generate email if not provided ---
    if (!email || email.trim() === '') {
        email = generateEmailFromName(name);
    }
    // -----------------------------------------------------------

    await validateProgramExists(program);

    const studentIdExists = await Student.findOne({ studentIdNumber: studentIdNumber.trim() });
    if (studentIdExists) return next(new Error(`Student with ID ${studentIdNumber} already exists.`));

    const emailExists = await Student.findOne({ email: email.toLowerCase().trim() });
    if(emailExists) return next(new Error(`Student with email ${email} already exists.`));
    
    if (program.toUpperCase() === 'ACT' && parseInt(yearLevel, 10) > 2) {
        return next(new Error('ACT program is only available for Year 1 and 2.'));
    }

    const student = await Student.create({
        studentIdNumber: studentIdNumber.trim(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        program: program.trim().toUpperCase(),
        yearLevel: parseInt(yearLevel, 10),
        section: section ? section.trim().toUpperCase() : undefined,
    });

    res.status(201).json({ success: true, message: 'Student added successfully', data: student });
});

const updateStudent = asyncHandler(async (req, res, next) => {
    let student = await Student.findById(req.params.id);
    if (!student) return next(new Error(`Student not found with ID: ${req.params.id}`));

    const { studentIdNumber, name, email, program, yearLevel, section, profilePictureUrl } = req.body;

    // --- THIS IS THE FIX: Update email correctly ---
    if (email && email.toLowerCase().trim() !== student.email) {
        const emailExists = await Student.findOne({ email: email.toLowerCase().trim(), _id: { $ne: student._id } });
        if (emailExists) return next(new Error(`Email ${email} is already in use.`));
        student.email = email.toLowerCase().trim();
    }
    // ---------------------------------------------
    
    // ... (rest of update logic)
    if (studentIdNumber) student.studentIdNumber = studentIdNumber.trim();
    if (name) student.name = name.trim();
    if (program) {
        await validateProgramExists(program);
        student.program = program.trim().toUpperCase();
    }
    if (yearLevel) student.yearLevel = parseInt(yearLevel, 10);
    if (section) student.section = section.trim().toUpperCase();
    if (profilePictureUrl) student.profilePictureUrl = profilePictureUrl.trim();

    const updatedStudent = await student.save();
    res.status(200).json({ success: true, message: 'Student updated successfully', data: updatedStudent });
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