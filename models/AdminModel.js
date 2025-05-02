// models/AdminModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Import bcrypt for hashing

// Define the schema for the Admin collection
const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'], // Add custom error messages
            trim: true, // Remove leading/trailing whitespace
        },
        email: {
            // La Verdad Email address expected
            type: String,
            required: [true, 'Please add an email'],
            unique: true, // Ensure email addresses are unique in the collection
            match: [
                // Simple regex to check for @lvcc.edu.ph ending
                // Adjust if the domain format is different
                /.+@lvcc\.edu\.ph$/,
                'Please use a valid La Verdad email address (@lvcc.edu.ph)',
            ],
            lowercase: true, // Store email in lowercase for consistency
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            minlength: [6, 'Password must be at least 6 characters long'], // Enforce minimum length
            select: false, // Prevent password from being returned in queries by default
        },
        // Add other fields if needed for admins later (e.g., role)
        // role: {
        //   type: String,
        //   enum: ['admin', 'superadmin'], // Example roles
        //   default: 'admin',
        // }
    },
    {
        // Automatically add createdAt and updatedAt timestamps
        timestamps: true,
    }
);

// Middleware: Hash password BEFORE saving a new admin document
// Using a regular function here allows 'this' to refer to the document being saved
adminSchema.pre('save', async function (next) {
    // Only run this function if password was modified (or is new)
    if (!this.isModified('password')) {
        return next(); // Skip hashing if password hasn't changed
    }

    try {
        // Generate a salt (random bytes to add to hashing)
        const salt = await bcrypt.genSalt(10); // 10 rounds is generally secure enough
        // Hash the password using the generated salt
        this.password = await bcrypt.hash(this.password, salt);
        next(); // Proceed to save the document
    } catch (error) {
        next(error); // Pass any error during hashing to the error handler
    }
});

// Instance Method: Compare entered password with the hashed password in the database
// This will be added to each admin document instance
adminSchema.methods.matchPassword = async function (enteredPassword) {
    // 'this.password' refers to the hashed password of the specific admin document
    // Need to explicitly select password if it was excluded in the query
    return await bcrypt.compare(enteredPassword, this.password);
};

// Create and export the Mongoose model
module.exports = mongoose.model('Admin', adminSchema); // Model name 'Admin', uses 'admins' collection