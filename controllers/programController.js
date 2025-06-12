const Program = require('../models/ProgramModel');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// @desc    Get all programs
// @route   GET /api/v1/programs
// @access  Public (or Private if you prefer)
const getPrograms = asyncHandler(async (req, res) => {
    const programs = await Program.find({}).sort({ name: 1 });
    res.status(200).json({
        success: true,
        count: programs.length,
        data: programs,
    });
});

// @desc    Add a new program
// @route   POST /api/v1/programs
// @access  Private (Admin Only)
const addProgram = asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        return next(new Error(errors.array().map(err => err.msg).join(', ')));
    }

    const { name, description } = req.body;

    const programExists = await Program.findOne({ name: name.toUpperCase() });
    if (programExists) {
        res.status(400);
        return next(new Error(`Program with name '${name.toUpperCase()}' already exists.`));
    }

    const program = await Program.create({
        name: name.toUpperCase(),
        description,
    });

    res.status(201).json({
        success: true,
        data: program,
    });
});

// @desc    Update a program
// @route   PUT /api/v1/programs/:id
// @access  Private (Admin Only)
const updateProgram = asyncHandler(async (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error('Invalid program ID format.'));
    }

    const program = await Program.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!program) {
        res.status(404);
        return next(new Error(`Program not found with ID: ${req.params.id}`));
    }

    res.status(200).json({
        success: true,
        data: program,
    });
});

// @desc    Delete a program
// @route   DELETE /api/v1/programs/:id
// @access  Private (Admin Only)
const deleteProgram = asyncHandler(async (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        return next(new Error('Invalid program ID format.'));
    }

    const program = await Program.findById(req.params.id);

    if (!program) {
        res.status(404);
        return next(new Error(`Program not found with ID: ${req.params.id}`));
    }
    
    // Optional: Add logic here to check if any students or schedules are using this program before deleting.
    // For now, we will allow deletion.

    await program.deleteOne();

    res.status(200).json({ success: true, data: {} });
});


module.exports = {
    getPrograms,
    addProgram,
    updateProgram,
    deleteProgram,
};