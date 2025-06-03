// config/firebaseAdmin.js
const admin = require('firebase-admin');
const dotenv = require('dotenv'); // To load .env for local file path

dotenv.config(); // Load .env variables

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // For Render/production: using Base64 encoded service account
    console.log('Initializing Firebase Admin with Base64 Service Account...'.cyan);
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const serviceAccountJsonString = Buffer.from(serviceAccountBase64, 'base64').toString('ascii');
    const serviceAccount = JSON.parse(serviceAccountJsonString);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully (Base64).'.green);

  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // For local development: using a file path specified in an env variable
    // GOOGLE_APPLICATION_CREDENTIALS should be the full path to your service account JSON file.
    // e.g., in your .env: GOOGLE_APPLICATION_CREDENTIALS=./config/firebase-service-account-key.json
    console.log(`Initializing Firebase Admin with Service Account file from GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`.cyan);
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('Firebase Admin SDK initialized successfully (File Path).'.green);
  } else {
    // Fallback for local development if GOOGLE_APPLICATION_CREDENTIALS is not set,
    // assuming the file is in a known path.
    // THIS IS LESS SECURE and less flexible, prefer GOOGLE_APPLICATION_CREDENTIALS or Base64.
    const serviceAccountPath = require('path').resolve(__dirname, './firebase-service-account-key.json'); // Adjust path as needed
    console.log(`Initializing Firebase Admin with local Service Account file: ${serviceAccountPath}`.cyan);
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully (Local Fallback Path).'.green);
  }
} catch (error) {
  console.error('Firebase Admin SDK Initialization Error:'.red, error.message);
  // Decide if you want to throw the error or exit, as this is critical for Google Sign-In.
  // For now, we'll log and let the app continue, but Google Sign-In will fail.
  // throw new Error('Failed to initialize Firebase Admin SDK. Google Sign-In will not work.');
}

module.exports = admin;