// models/MealRecordModel.js
const mongoose = require('mongoose');

// Define the possible statuses for a meal record
const MEAL_RECORD_STATUSES = [
    'CLAIMED',                      // Student was eligible and claimed the meal
    'INELIGIBLE_NOT_SCHEDULED',     // Student was not scheduled for eligibility on this day
    'INELIGIBLE_STUDENT_NOT_FOUND', // Student ID scanned/entered was not found in the masterlist
    // Future potential statuses:
    // 'ELIGIBLE_BUT_NOT_CLAIMED',  // If system logs all eligible students daily and tracks non-claims
    // 'INELIGIBLE_SYSTEM_ERROR'    // If there was an error during the check
];

const mealRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student', // Reference to the Student model
      required: [true, 'Student reference is required for a meal record'],
      index: true, // Index for faster queries filtering by student
    },
    studentIdNumber: { // Denormalize for easier querying/display if student doc is deleted
        type: String,
        required: [true, 'Student ID Number is required at time of record'],
        trim: true,
    },
    programAtTimeOfRecord: { // Denormalize program for historical accuracy
        type: String,
        required: [true, 'Program is required at time of record'],
        uppercase: true,
    },
    yearLevelAtTimeOfRecord: { // Denormalize year level
        type: Number,
        required: [true, 'Year level is required at time of record'],
    },
    dateChecked: {
      // The date and time the eligibility check was performed / meal was claimed
      type: Date,
      required: [true, 'Date of check/claim is required'],
      default: Date.now,
      index: true, // Index for efficient querying by date ranges (crucial for dashboard)
    },
    status: {
      type: String,
      required: [true, 'Meal record status is required'],
      enum: {
        values: MEAL_RECORD_STATUSES,
        message: '{VALUE} is not a supported meal record status',
      },
    },
    // Optional: Who performed the check (if kitchen staff have identifiers)
    // checkedBy: {
    //   type: String, // Could be a staff ID or name
    //   trim: true,
    // },
    // Optional: Notes or reasons, especially for ineligible statuses
    // notes: {
    //   type: String,
    //   trim: true,
    // }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Optional: Compound index for common dashboard queries
// Example: if often querying by date, program, and status
// mealRecordSchema.index({ dateChecked: 1, programAtTimeOfRecord: 1, status: 1 });


module.exports = mongoose.model('MealRecord', mealRecordSchema);