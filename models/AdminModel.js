// models/AdminModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            match: [
                /.+@(student\.)?laverdad\.edu\.ph$/,
                'Please use a valid La Verdad email address (@laverdad.edu.ph)',
            ],
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            minlength: [6, 'Password must be at least 6 characters long'],
            select: false,
        },
        passwordResetToken: {
            type: String,
            select: false, // Usually, we don't want to send this out unless specifically requested
        },
        passwordResetExpires: {
            type: Date,
            select: false,
        },
           profilePictureUrl: {
            type: String,
            trim: true,
        }
        // role: {
        //   type: String,
        //   enum: ['admin', 'superadmin'],
        //   default: 'admin',
        // }
    },
    {
        timestamps: true,
    }
);

adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

adminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);