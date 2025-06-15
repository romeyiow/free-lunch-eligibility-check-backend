// controllers/authController.js
const colors = require('colors');
const Admin = require('../models/AdminModel');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('express-async-handler');
const sendEmail = require('../utils/sendEmail'); // Import the sendEmail utility
const crypto = require('crypto');
const firebaseAdmin = require('../config/firebaseAdmin');


// @desc    Authenticate admin & get token
// @route   POST /api/v1/auth/login
// @access  Public
const loginAdmin = async (req, res, next) => {
    const { email, password } = req.body;

    // Basic Validation: Check if email and password exist
    if (!email || !password) {
        res.status(400); // Bad Request
        return next(new Error('Please provide both email and password'));
        // Using return next(error) is better than just throwing error in async functions without asyncHandler
    }

    // Find admin by email - use select('+password') to explicitly include the password field
    // which we excluded by default in the AdminModel schema (select: false)
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');

    // Check if admin exists and if password matches
    if (admin && (await admin.matchPassword(password))) {
        // Password matches - generate token
        const token = generateToken(admin._id);

        // Send response with user info (excluding password) and token
        res.status(200).json({
            success: true,
            message: 'Login successful',
            token, // Include the JWT in the response
            admin: { // Send back some admin details (never the password)
                _id: admin._id,
                name: admin.name,
                email: admin.email,
            },
        });
    } else {
        // Admin not found or password doesn't match
        res.status(401); // Unauthorized
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
    // For stateless JWTs, true logout is handled client-side by deleting the token.
    // This backend endpoint can confirm the logout action and is protected
    // to ensure only an authenticated user can "log out".
    // If we were using sessions or a token blocklist, more logic would go here.

    res.status(200).json({
        success: true,
        message: 'Admin logged out successfully. Please clear token on client-side.',
    });
});

// @desc    Request Password Reset (generates code/token and sends email)
// @route   POST /api/v1/auth/request-password-reset
// @access  Public
const requestPasswordReset = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email address.');
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
        // To prevent email enumeration, send a generic success response.
        console.log(`Password reset requested for non-existent or non-admin email: ${email}`.yellow);
        return res.status(200).json({
            success: true,
        message: 'If an account with that email exists, instructions to reset your password have been sent.',
        });
    }

    // Generate a simple 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes in milliseconds

    admin.passwordResetToken = resetCode;
    admin.passwordResetExpires = resetCodeExpires;

    await admin.save(); // Validate and save the updated admin document

    // Prepare email content
    const resetEmailSubject = 'Your Password Reset Code';
    const resetEmailText = `You are receiving this email because you (or someone else) has requested the reset of a password for your account.\n\nYour password reset code is: ${resetCode}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`;
    const resetEmailHtml = `<p>You are receiving this email because you (or someone else) has requested the reset of a password for your account.</p>
                           <p>Your password reset code is: <strong>${resetCode}</strong></p>
                           <p>This code will expire in 10 minutes.</p>
                           <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`;

    try {
        await sendEmail({
            to: admin.email,
            subject: resetEmailSubject,
            text: resetEmailText,
            html: resetEmailHtml,
        });

        res.status(200).json({
            success: true,
            message: `Password reset instructions have been sent to ${admin.email}.`,
        });
    } catch (error) {
        console.error('Failed to send password reset email:'.red, error);
        // If email sending fails, we should ideally not leave the user thinking a code was sent.
        // However, we also don't want to reveal too much.
        // For simplicity in the capstone, we'll clear the token if the email fails,
        // so the user isn't stuck with an unusable token.
        admin.passwordResetToken = undefined;
        admin.passwordResetExpires = undefined;
        await admin.save(); // Attempt to revert token saving

        // It's important to let the calling client know that the operation as a whole may not have fully succeeded.
        // You might return a more generic error or a specific one indicating email failure.
        // For now, let's pass the error to the main error handler.
        // next(new Error('There was an issue sending the password reset email. Please try again.'));
        // Or, even better for the client, a success false with message
        res.status(500).json({ // Internal Server Error, as email sending is a server-side op
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

        admin.name = name;
        admin.profilePictureUrl = picture;
        await admin.save();

    // Generate your application's JWT for this admin
        const appToken = generateToken(admin._id);

        res.status(200).json({
            success: true,
            message: 'Google Sign-In successful.',
        token: appToken, // Your application's JWT
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
            res.status(401); // Unauthorized
            throw new Error('Invalid or expired Firebase token. Please try signing in again.');
        }
        // Re-throw other errors to be handled by the global error handler,
        // or handle them specifically if they are thrown by our custom logic above (like 403 errors)
        if (!res.headersSent) { // If we haven't already sent a response
            res.status(error.statusCode || 500);
        }
    throw error; // Let asyncHandler pass it to your global errorHandler
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

    // --- THIS IS THE NEW CHECK ---
    if (oldPassword === newPassword) {
        res.status(400);
        throw new Error('New password cannot be the same as the old password.');
    }
    // ----------------------------

    const admin = await Admin.findById(req.admin._id).select('+password');

    if (!admin) {
        res.status(404);
        throw new Error('Admin not found.');
    }

    if (!(await admin.matchPassword(oldPassword))) {
        res.status(401);
        throw new Error('Incorrect old password.');
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