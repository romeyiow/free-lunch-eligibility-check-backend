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
        // You can add more fields here if needed, like 'department'
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Program', programSchema);