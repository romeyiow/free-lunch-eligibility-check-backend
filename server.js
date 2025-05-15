// Import Core Modules
const path = require('path'); // Node.js module for working with file paths
const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors'); // For colorful console output
const cors = require('cors'); // Enable Cross-Origin Resource Sharing
const helmet = require('helmet'); // Set security-related HTTP headers
const morgan = require('morgan'); // HTTP request logger middleware
const rateLimit = require('express-rate-limit');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const connectDB = require('./config/db'); // Import the database connection function

// Import Custom Modules (Placeholders for now, uncomment/add in later phases)
// const connectDB = require('./config/db'); // Phase 2: Database connection
// const { notFound, errorHandler } = require('./middleware/errorMiddleware'); // Phase 3: Error Handling
// const authRoutes = require('./routes/authRoutes'); // Phase 3/5: Auth routes
// const studentRoutes = require('./routes/studentRoutes'); // Phase 6: Student routes
// const scheduleRoutes = require('./routes/scheduleRoutes'); // Phase 6: Schedule routes
// const eligibilityRoutes = require('./routes/eligibilityRoutes'); // Phase 6: Eligibility routes
// const recordRoutes = require('./routes/recordRoutes'); // Phase 6: Meal Record routes
// const dashboardRoutes = require('./routes/dashboardRoutes'); // Phase 6: Dashboard routes

// Load Environment Variables
// Note: In Codespaces, secrets are automatically loaded into process.env
// dotenv.config() is still useful if you run locally with a .env file.
dotenv.config();

// Connect to Database
connectDB(); // Call the function to establish the connection

// Initialize Express App
const app = express();

// --- Global Middleware ---

// Security Headers (Helmet)
app.use(helmet());

// Enable CORS (Cross-Origin Resource Sharing)
// TODO: Configure specific origins for production instead of allowing all
app.use(cors());

// HTTP Request Logging (Morgan)
// Logs details about incoming requests to the console in development mode
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Body Parsing Middleware
// Allows access to req.body for JSON and URL-encoded data
app.use(express.json()); // Parses incoming requests with JSON payloads
app.use(express.urlencoded({ extended: true })); // Parses incoming requests with URL-encoded payloads

// Rate Limiting Configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers (legacy)
    // Message sent when rate limit is exceeded
    message: {
        success: false,
        error: {
            message: 'Too many requests created from this IP, please try again after 15 minutes',
        },
    },
    // Optional: Customize key generation (e.g., use user ID after login)
    // keyGenerator: (req, res) => { /* ... */ },
    // Optional: Skip certain requests (e.g., OPTIONS pre-flight requests)
    // skip: (req, res) => { /* return true to skip */ },
});

// Apply the rate limiting middleware to all requests starting with /api
// Or apply globally with just: app.use(limiter);
app.use('/api', limiter); // Apply limiter specifically to API routes

// --- API Routes ---
// Define API Version Prefix for consistency and future-proofing
const API_VERSION = '/api/v1';
const authRoutes = require('./routes/authRoutes'); // Import the router
const studentRoutes = require('./routes/studentRoutes'); // Import student routes
const scheduleRoutes = require('./routes/scheduleRoutes'); // Import schedule routes

// Basic Health Check Route (Good practice for monitoring)
app.get(`${API_VERSION}/health`, (req, res) => {
    // Return a consistent JSON response format
    res.status(200).json({
        success: true, // Indicate success explicitly
        status: 'UP',
        timestamp: new Date().toISOString(),
    });
});

// Mount Routers (Uncomment and add specific routers in later phases)
app.use(`${API_VERSION}/auth`, authRoutes);
app.use(`${API_VERSION}/students`, studentRoutes);
app.use(`${API_VERSION}/schedules`, scheduleRoutes);
// app.use(`${API_VERSION}/eligibility`, eligibilityRoutes);
// app.use(`${API_VERSION}/meal-records`, recordRoutes);
// app.use(`${API_VERSION}/dashboard`, dashboardRoutes);


// --- Error Handling Middleware (Uncomment/Add in Phase 3) ---
// Should be placed AFTER all routes
app.use(notFound); // Handles 404 errors (route not found)
app.use(errorHandler); // Handles all other errors passed via next(error)

// --- Start Server ---
const PORT = process.env.PORT || 5001; // Use port from env var or default

app.listen(PORT, () => {
    console.log(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
    );
});

// Handle unhandled promise rejections (Good practice for catching async errors)
process.on('unhandledRejection', (err, promise) => {
    console.error(`Unhandled Rejection: ${err.message}`.red);
    // Optionally close server gracefully - uncomment if needed
    // server.close(() => process.exit(1));
});