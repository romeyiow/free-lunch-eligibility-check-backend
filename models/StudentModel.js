const mongoose = require('mongoose');

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
            uppercase: true,
        },
        yearLevel: {
            type: Number,
            required: [true, 'Please specify the year level'],
            min: [1, 'Year level must be at least 1'],
            max: [4, 'Year level cannot exceed 4'],
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
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Student', studentSchema);