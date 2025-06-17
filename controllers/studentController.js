const mongoose = require('mongoose');
const Student = require('../models/StudentModel');
const Program = require('../models/ProgramModel');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');

// Helper to generate a unique email from a name
const generateUniqueEmail = async (name) => {
    let emailBase = name.replace(/\s+/g, '').toLowerCase();
    let email = `${emailBase}@student.laverdad.edu.ph`;
    let count = 0;
    
    while (await Student.findOne({ email: email })) {
        count++;
        email = `${emailBase}${count}@student.laverdad.edu.ph`;
    }
    return email;
};

const validateProgramExists = async (programName) => {
    const program = await Program.findOne({ name: programName.toUpperCase() });
    if (!program) throw new Error(`Program '${programName.toUpperCase()}' does not exist.`);
    return true;
};

const addStudent = asyncHandler(async (req, res, next) => {
    const { studentIdNumber, name, program, yearLevel, section } = req.body;
    
    const requiredFields = { name, studentIdNumber, program, yearLevel };
    for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || String(value).trim() === '') {
            res.status(400);
            return next(new Error(`${field.charAt(0).toUpperCase() + field.slice(1)} is a required field.`));
        }
    }
    
    await validateProgramExists(program);

    const studentIdExists = await Student.findOne({ studentIdNumber: studentIdNumber.trim() });
    if (studentIdExists) {
        res.status(400);
        return next(new Error(`Student with ID ${studentIdNumber} already exists.`));
    }

    const email = await generateUniqueEmail(name.trim());

    if (program.toUpperCase() === 'ACT' && parseInt(yearLevel, 10) > 2) {
        res.status(400);
        return next(new Error('ACT program is only available for Year 1 and 2.'));
    }

    const student = await Student.create({
        studentIdNumber: studentIdNumber.trim(),
        name: name.trim(),
        email: email,
        program: program.trim().toUpperCase(),
        yearLevel: parseInt(yearLevel, 10),
        section: section ? section.trim().toUpperCase() : undefined,
    });

    res.status(201).json({ success: true, message: 'Student added successfully', data: student });
});

const updateStudent = asyncHandler(async (req, res, next) => {
    let student = await Student.findById(req.params.id);
    if (!student) {
        res.status(404);
        return next(new Error(`Student not found with ID: ${req.params.id}`));
    }

    const { studentIdNumber, name, program, yearLevel, section } = req.body;

    if (name && name.trim() !== student.name) {
        student.name = name.trim();
        student.email = await generateUniqueEmail(student.name);
    }

    if (studentIdNumber && studentIdNumber.trim() !== student.studentIdNumber) {
        const studentIdExists = await Student.findOne({ studentIdNumber: studentIdNumber.trim() });
        if (studentIdExists) {
            res.status(400);
            return next(new Error(`Student ID ${studentIdNumber} is already in use.`));
        }
        student.studentIdNumber = studentIdNumber.trim();
    }
    
    if (program) {
        await validateProgramExists(program);
        student.program = program.trim().toUpperCase();
    }
    if (yearLevel) student.yearLevel = parseInt(yearLevel, 10);
    if (section !== undefined) student.section = section ? section.trim().toUpperCase() : null;
    
    const updatedStudent = await student.save();
    res.status(200).json({ success: true, message: 'Student updated successfully', data: updatedStudent });
});

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

   
    if (req.query.program) {
        sortOptions = { yearLevel: 1, name: 1 };
    } else if (sortBy) {
        const allowedSortKeys = ['name', 'program', 'yearLevel', 'studentIdNumber', 'createdAt', 'updatedAt'];
        if (allowedSortKeys.includes(sortBy)) {
            sortOptions[sortBy] = (order === 'desc') ? -1 : 1;
        } else {
            sortOptions.name = 1; 
        }
    } else {
        sortOptions.name = 1;
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 8;
    const startIndex = (page - 1) * limit;

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
    
    res.status(200).json({
        success: true,
        count: students.length,
        pagination,
        data: students,
    });
});

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