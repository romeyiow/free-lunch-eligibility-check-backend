const colors = require('colors');
const Admin = require('../models/AdminModel');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('express-async-handler');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const firebaseAdmin = require('../config/firebaseAdmin');


// @desc    Authenticate admin & get token
// @route   POST /api/v1/auth/login
// @access  Public
const loginAdmin = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        return next(new Error('Please provide both email and password'));
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');

    if (admin && (await admin.matchPassword(password))) {
        const token = generateToken(admin._id);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                profilePictureUrl: admin.profilePictureUrl
            },
        });
    } else {
        res.status(401);
        return next(new Error('Invalid email or password'));
    }
};

// @desc    Get current logged-in admin profile
// @route   GET /api/v1/auth/me
// @access  Private (Requires JWT)
const getAdminProfile = asyncHandler((req, res, next) => {
    // The 'protect' middleware should have already attached the admin document to req.admin
    if (req.admin) {
        res.status(200).json({
            success: true,
            admin: req.admin // Send the admin data attached by the middleware
        });
    } else {
        // This case should technically not be reached if protect middleware works correctly
        res.status(404);
        return next(new Error('Admin profile not found'));
    }
});

// @desc    Log out current admin (cosmetic for stateless JWT)
// @route   POST /api/v1/auth/logout
// @access  Private (Requires JWT)
const logoutAdmin = asyncHandler(async (req, res, next) => {
    res.status(200).json({
        success: true,
        message: 'Admin logged out successfully. Please clear token on client-side.',
    });
});

// @desc    Request Password Reset (generates code and sends email)
// @route   POST /api/v1/auth/request-password-reset
// @access  Public
const requestPasswordReset = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email address.');
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    
   
    let useGmailForSending = false;
    let recipientEmail = process.env.ETHEREAL_CATCH_ALL_EMAIL || 'test@example.com'; // A fallback for ethereal
    let resetCode = '123456'; // A dummy code for non-existent users
    
    if (admin) {
     
        useGmailForSending = true;
        recipientEmail = admin.email;
        resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        const resetCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        admin.passwordResetToken = resetCode;
        admin.passwordResetExpires = resetCodeExpires;
        await admin.save();
    } else {
        // If admin does not exist, we prepare to send to Ethereal
        console.log(`Password reset requested for non-existent email: ${email}. Logging to Ethereal.`.yellow);
    }
    

    const resetEmailSubject = 'Your Password Reset Code';
    const resetEmailText = `You requested a password reset. Your code is: ${resetCode}\nThis code expires in 10 minutes. If you did not request this, please ignore this email.`;
    const resetEmailHtml = `<p>You requested a password reset. Your code is: <strong>${resetCode}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not request this, please ignore this email.</p>`;

    try {
        await sendEmail({
            to: recipientEmail,
            subject: resetEmailSubject,
            text: resetEmailText,
            html: resetEmailHtml,
            useGmail: useGmailForSending // Pass the flag to the email utility
        });
        
        // Always send a generic success response to the user to prevent email enumeration
        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, instructions to reset your password have been sent.',
        });

    } catch (error) {
        // If email sending fails, we should ideally not leave the user thinking a code was sent.
        if (admin) {
            admin.passwordResetToken = undefined;
            admin.passwordResetExpires = undefined;
            await admin.save();
        }
        res.status(500).json({
            success: false,
            error: { message: 'Failed to send password reset email. Please try again later.' }
        });
    }
});


// @desc    Reset Password using Reset Code
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPasswordWithCode = asyncHandler(async (req, res, next) => {
    const { email, resetCode, newPassword } = req.body;

    // 1. Validate input
    if (!email || !resetCode || !newPassword) {
        res.status(400);
        throw new Error('Please provide email, reset code, and a new password.');
    }

    if (newPassword.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters long.');
    }

    // 2. Find the admin by email and select the reset token fields
    // We need to explicitly select these fields because their schema definition has `select: false`
    const admin = await Admin.findOne({ email: email.toLowerCase() })
        .select('+passwordResetToken +passwordResetExpires');

    // 3. Verify admin, reset code, and expiry
    if (!admin) {
        // Although we try to prevent enumeration in requestPasswordReset,
        // if someone guesses an email and tries to reset with a random code,
        // this check is still important.
        res.status(400); // Or 404, but 400 is fine for "bad request / invalid inputs"
        throw new Error('Invalid email or reset code. Please try again.');
    }

    if (!admin.passwordResetToken || admin.passwordResetToken !== resetCode) {
        res.status(400);
        throw new Error('Invalid or incorrect reset code.');
    }

    if (admin.passwordResetExpires < Date.now()) {
        // Clear the expired token from the DB to force user to request a new one
        admin.passwordResetToken = undefined;
        admin.passwordResetExpires = undefined;
        await admin.save({ validateBeforeSave: false }); // Save without full validation if just clearing fields

        res.status(400);
        throw new Error('Password reset code has expired. Please request a new one.');
    }

    // 4. All checks passed, update the password
    admin.password = newPassword; // The pre-save hook in AdminModel will hash this
    admin.passwordResetToken = undefined; // Clear the reset token
    admin.passwordResetExpires = undefined; // Clear the expiry

    await admin.save(); // This will trigger the pre-save hook to hash the new password

    // 5. Send success response
    // Optionally, you could also log the user in here by generating a new JWT,
    // but for simplicity, just confirming password reset is fine.
    // The user can then log in with their new password.
    res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
    });
});


// @desc    Handle Google Sign-In
// @route   POST /api/v1/auth/google-login
// @access  Public
const googleLogin = asyncHandler(async (req, res, next) => {
    const { token: firebaseIdToken } = req.body; // Token sent from frontend

    if (!firebaseIdToken) {
        res.status(400);
        throw new Error('Firebase ID token is required.');
    }

    try {
        // Verify the ID token using Firebase Admin SDK
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(firebaseIdToken);
        const { email, name, picture } = decodedToken; // Extract user info from token

        // --- Custom Logic: Find or Create Admin based on Google Email ---
        const lvccEmailRegex = /.+@(student\.)?laverdad\.edu\.ph$/i; // Case insensitive

        if (!email || !lvccEmailRegex.test(email.toLowerCase())) {
            res.status(403); // Forbidden
            throw new Error('Access denied. Only La Verdad Christian College affiliated accounts are permitted.');
        }

        let admin = await Admin.findOne({ email: email.toLowerCase() });

        if (!admin) {
            res.status(403);
            throw new Error('Admin account not found. Please contact support if you believe this is an error.');
        }

        const highResPictureUrl = picture ? picture.replace('=s96-c', '=s256-c') : null;
        admin.name = name;
        admin.profilePictureUrl = highResPictureUrl;
        await admin.save();

        // Generate your application's JWT for this admin
        const appToken = generateToken(admin._id);

        res.status(200).json({
            success: true,
            message: 'Google Sign-In successful.',
            token: appToken,
            admin: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                profilePictureUrl: admin.profilePictureUrl
            },
        });

    } catch (error) {
        console.error('Google Sign-In backend error:'.red, error.message);
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked') {
            res.status(401);
            throw new Error('Invalid or expired Firebase token. Please try signing in again.');
        }
        if (!res.headersSent) {
            res.status(error.statusCode || 500);
        }
        throw error;
    }
});


// @desc    Change admin password while logged in
// @route   PUT /api/v1/auth/change-password
// @access  Private (Requires JWT)
const changePassword = asyncHandler(async (req, res, next) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        res.status(400);
        throw new Error('Please provide both old and new passwords.');
    }

    if (newPassword.length < 6) {
        res.status(400);
        throw new Error('New password must be at least 6 characters long.');
    }

    if (oldPassword === newPassword) {
        res.status(400);
        throw new Error('New password cannot be the same as the old password.');
    }
    const admin = await Admin.findById(req.admin._id).select('+password');

    if (!admin) {
        res.status(404);
        throw new Error('Admin not found.');
    }

    if (!(await admin.matchPassword(oldPassword))) {
        res.status(401);
        throw new Error('Incorrect Password');
    }

    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
        success: true,
        message: 'Password changed successfully.',
    });
});

module.exports = {
    loginAdmin,
    getAdminProfile,
    logoutAdmin,
    requestPasswordReset,
    resetPasswordWithCode,
    googleLogin,
    changePassword,
};