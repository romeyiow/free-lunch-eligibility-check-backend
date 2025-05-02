// config/db.js
const mongoose = require('mongoose');
const colors = require('colors'); // Optional: for colored console output

const connectDB = async () => {
    try {
        // Check if the MongoDB URI is provided in environment variables
        if (!process.env.MONGO_URI) {
            console.error('FATAL ERROR: MONGO_URI environment variable is not set.'.red.underline.bold);
            process.exit(1); // Exit process with failure code
        }

        // Attempt to connect to MongoDB using the URI from environment variables
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // Mongoose connection options to avoid deprecation warnings
            // These might change slightly with newer Mongoose versions, but are generally safe
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // useCreateIndex: true, // No longer needed/supported in Mongoose 6+
            // useFindAndModify: false // No longer needed/supported in Mongoose 6+
        });

        // Log success message with the connected host
        console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline);

    } catch (error) {
        // Log detailed error message if connection fails
        console.error(`Error connecting to MongoDB: ${error.message}`.red.bold);
        // Exit process with failure code
        process.exit(1);
    }
};

// Export the connectDB function to be used in server.js
module.exports = connectDB;