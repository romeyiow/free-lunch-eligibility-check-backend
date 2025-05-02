// models/StudentModel.js
const mongoose = require('mongoose');

// Define allowed programs based on your list
const ALLOWED_PROGRAMS = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];

const studentSchema = new mongoose.Schema(
    {
        studentIdNumber: {
            type: String,
            required: [true, 'Please add a student ID number'],
            unique: true,
            trim: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Please add a student name'],
            trim: true,
        },
        program: {
            type: String,
            required: [true, 'Please specify the program'],
            trim: true,
            uppercase: true, // Store program codes in uppercase
            enum: { // Use enum for basic program validation
                values: ALLOWED_PROGRAMS,
                message: 'Program {VALUE} is not supported' // Custom error message
            }
        },
        yearLevel: {
            type: Number,
            required: [true, 'Please specify the year level'],
            min: [1, 'Year level must be at least 1'],
            max: [4, 'Year level cannot exceed 4'],
            // Note: The complex validation (ACT only Yr 1/2) will be handled
            // in controller logic (Phase 6) as it involves checking two fields.
        },
        section: {
            type: String,
            trim: true,
            uppercase: true,
        },
        profilePictureUrl: {
            type: String,
            default: '/images/default-avatar.png',
            trim: true,
        },
        // isEligible field REMOVED based on Change 2
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Student', studentSchema);