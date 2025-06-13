const mongoose = require('mongoose');

const MEAL_RECORD_STATUSES = [
    'CLAIMED',
    'INELIGIBLE_NOT_SCHEDULED',
    'INELIGIBLE_STUDENT_NOT_FOUND',
    'ELIGIBLE_BUT_NOT_CLAIMED',
];

const mealRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: false, // <-- THIS IS THE FIX. Changed from 'true'.
      index: true,
    },
    studentIdNumber: {
        type: String,
        required: [true, 'Student ID Number is required at time of record'],
        trim: true,
    },
    programAtTimeOfRecord: {
        type: String,
        required: [true, 'Program is required at time of record'],
        uppercase: true,
    },
    yearLevelAtTimeOfRecord: {
        type: Number,
        required: [true, 'Year level is required at time of record'],
    },
    dateChecked: {
      type: Date,
      required: [true, 'Date of check/claim is required'],
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      required: [true, 'Meal record status is required'],
      enum: {
        values: MEAL_RECORD_STATUSES,
        message: '{VALUE} is not a supported meal record status',
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MealRecord', mealRecordSchema);