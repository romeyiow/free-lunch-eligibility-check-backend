const mongoose = require('mongoose');

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const scheduleSchema = new mongoose.Schema(
  {
    program: {
      type: String,
      required: [true, 'Program is required for schedule entry'],
      uppercase: true,
    },
    yearLevel: {
      type: Number,
      required: [true, 'Year level is required for schedule entry'],
      min: [1, 'Year level must be at least 1'],
      max: [4, 'Year level cannot exceed 4'],
    },
    dayOfWeek: {
      type: String,
      required: [true, 'Day of the week is required'],
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day of the week',
      },
    },
    isEligible: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

scheduleSchema.index({ program: 1, yearLevel: 1, dayOfWeek: 1 }, { unique: true });

scheduleSchema.pre('save', function(next) {
    if (this.program === 'ACT' && this.yearLevel > 2) {
        const err = new Error('ACT program schedule is only available for Year 1 and 2.');
        return next(err);
    }
    next();
});

module.exports = mongoose.model('Schedule', scheduleSchema);