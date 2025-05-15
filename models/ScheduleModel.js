// models/ScheduleModel.js
const mongoose = require('mongoose');

// Define allowed programs (can be imported from a shared constants file later if needed)
const ALLOWED_PROGRAMS_FOR_SCHEDULE = ['BSA', 'BSAIS', 'BSIS', 'BSSW', 'BAB', 'ACT'];
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const scheduleSchema = new mongoose.Schema(
  {
    program: {
      type: String,
      required: [true, 'Program is required for schedule entry'],
      uppercase: true,
      enum: {
        values: ALLOWED_PROGRAMS_FOR_SCHEDULE,
        message: 'Program {VALUE} is not a valid program for scheduling',
      },
    },
    yearLevel: {
      type: Number,
      required: [true, 'Year level is required for schedule entry'],
      min: [1, 'Year level must be at least 1'],
      max: [4, 'Year level cannot exceed 4'], // ACT Y1/Y2 validation will be in controller
    },
    dayOfWeek: {
      type: String,
      required: [true, 'Day of the week is required'],
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day of the week',
      },
      // Example: 'Monday', 'Tuesday', etc.
    },
    isEligible: {
      // Indicates if students of this program/year are eligible on this day
      type: Boolean,
      default: false, // Or true, depending on your default assumption
      required: true,
    },
    // Optional: Add specific time slots if needed in the future
    // startTime: { type: String }, // e.g., "11:00"
    // endTime: { type: String }, // e.g., "13:00"
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound unique index to prevent duplicate entries for the same program, year, and day
// This means one program/year can only have one eligibility status per day of the week.
scheduleSchema.index({ program: 1, yearLevel: 1, dayOfWeek: 1 }, { unique: true });

// Validation for ACT program year level (cannot be Year 3 or 4)
// This pre-save hook provides an additional layer of validation at the model level.
scheduleSchema.pre('save', function(next) {
    if (this.program === 'ACT' && this.yearLevel > 2) {
        const err = new Error('ACT program schedule is only available for Year 1 and 2.');
        // You might want to set a specific status code or type for this error if needed later
        // For now, a simple error message is fine for Mongoose validation error.
        return next(err);
    }
    next();
});


module.exports = mongoose.model('Schedule', scheduleSchema);