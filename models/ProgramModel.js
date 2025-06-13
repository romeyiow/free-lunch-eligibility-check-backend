const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a program name (e.g., BSIS)'],
            unique: true,
            trim: true,
            uppercase: true,
        },
        description: {
            type: String,
            required: [true, 'Please add a full description (e.g., Bachelor of Science in Information Systems)'],
            trim: true,
        },
        color: {
            type: String,
            required: [true, 'Please add a hex color code for the program (e.g., #46050A)'],
            default: '#FFFFFF', // Default to white
            trim: true,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Program', programSchema);