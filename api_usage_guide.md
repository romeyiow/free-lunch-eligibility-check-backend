Okay, here's the more comprehensive API testing guide, updated to include Axios code snippets for your frontend developer. This will help them understand how to interact with the API.

---

**Comprehensive API Testing Guide (with Axios Examples)**

**Prerequisites:**
1.  Ensure your GitHub Codespaces environment is running.
2.  Start your backend server: `npm run dev` in the Codespaces terminal.
3.  Have your REST Client ready for manual testing, and your frontend developer can use the Axios examples.
4.  Replace `YOUR_CODESPACE_URL` below with your actual Codespaces Forwarded URL (e.g., `https://<your-codespace-name>-5001.app.github.dev`).
5.  Ensure your database has been seeded (`npm run data:import` if needed).
6.  The frontend developer will need `axios` installed in their project (`npm install axios` or `yarn add axios`).

---

**I. Health Check**

*   **Endpoint:** `GET YOUR_CODESPACE_URL/api/v1/health`
*   **Method:** `GET`
*   **Authorization:** None needed.
*   **Expected Status:** `200 OK`
*   **Expected Body (JSON):**
    ```json
    {
        "success": true,
        "status": "UP",
        "timestamp": "YYYY-MM-DDTHH:mm:ss.sssZ"
    }
    ```
*   **Purpose:** Verifies the server is running and reachable.
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js
    import axios from 'axios';

    const API_BASE_URL = 'YOUR_CODESPACE_URL/api/v1'; // Replace with actual base URL

    async function checkHealth() {
        try {
            const response = await axios.get(`${API_BASE_URL}/health`);
            console.log('Health Check:', response.data);
            // Expected: { success: true, status: 'UP', timestamp: '...' }
        } catch (error) {
            console.error('Health Check Error:', error.response ? error.response.data : error.message);
        }
    }

    // checkHealth();
    ```

---

**II. Admin Authentication (`/api/v1/auth`)**

**A. Admin Login**
*   **Endpoint:** `POST YOUR_CODESPACE_URL/api/v1/auth/login`
*   **Method:** `POST`
*   **Authorization:** None needed.
*   **Request Body (JSON):**
    ```json
    {
        "email": "admin@lvcc.edu.ph",
        "password": "password123"
    }
    ```
*   **Expected Status:** `200 OK`
*   **Expected Response Body (JSON):**
    ```json
    {
        "success": true,
        "message": "Login successful",
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // JWT string
        "admin": { "_id": "...", "name": "...", "email": "..." }
    }
    ```
*   **Action:** **Store the `token`** securely (e.g., localStorage, Vuex, Redux state) for subsequent protected requests.
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    // let authToken = null; // Store token globally or in state management

    async function loginAdmin(email, password) {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login`, {
                email: email,
                password: password,
            });
            console.log('Login Response:', response.data);
            if (response.data.success && response.data.token) {
                // authToken = response.data.token;
                localStorage.setItem('adminAuthToken', response.data.token); // Example storage
                console.log('Admin logged in. Token stored.');
                return response.data; // Contains token and admin info
            }
        } catch (error) {
            console.error('Login Error:', error.response ? error.response.data : error.message);
            // Expected error.response.data: { success: false, error: { message: '...' } }
            return null;
        }
    }

    // loginAdmin('admin@lvcc.edu.ph', 'password123').then(data => {
    //     if (data) { /* Proceed with logged-in state */ }
    // });
    ```
*   **Test Failure Cases (for manual testing):**
    1.  Incorrect Password (Status: `401`, Body: `{ "success": false, "error": { "message": "Invalid email or password" } }`)
    2.  Non-Existent Email (Status: `401`, Body similar to above)
    3.  Missing Fields (Status: `400`, Body: `{ "success": false, "error": { "message": "Please provide both email and password" } }`)

**B. Get Admin Profile (Protected Route)**
*   **Endpoint:** `GET YOUR_CODESPACE_URL/api/v1/auth/me`
*   **Method:** `GET`
*   **Authorization:** Bearer Token
*   **Expected Status:** `200 OK`
*   **Expected Response Body (JSON):**
    ```json
    {
        "success": true,
        "admin": { "_id": "...", "name": "...", "email": "..." }
    }
    ```
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getAdminProfile() {
        const token = localStorage.getItem('adminAuthToken'); // Retrieve token
        if (!token) {
            console.error('No auth token found. Please login.');
            return null;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log('Admin Profile:', response.data);
            return response.data.admin;
        } catch (error) {
            console.error('Get Profile Error:', error.response ? error.response.data : error.message);
            // Expected error.response.data for auth issues: { success: false, error: { message: 'Not authorized...' } }
            return null;
        }
    }

    // getAdminProfile().then(admin => { /* Use admin profile */ });
    ```
*   **Test Failure Cases (for manual testing):**
    1.  No Token (Status: `401`, Body: `{ "success": false, "error": { "message": "Not authorized, no token provided" } }`)
    2.  Invalid/Expired Token (Status: `401`, Body: `{ "success": false, "error": { "message": "Not authorized, token failed verification" } }`)

---

**III. Student Management (`/api/v1/students`)**
*(All these routes require Admin Authentication - set the `Authorization: Bearer <token>` header)*

**A. Add New Student**
*   **Endpoint:** `POST YOUR_CODESPACE_URL/api/v1/students`
*   **Method:** `POST`
*   **Authorization:** Bearer Token
*   **Request Body (JSON):**
    ```json
    {
        "studentIdNumber": "TEST-001-NEW",
        "name": "Test Student Add",
        "program": "BSIS",
        "yearLevel": 1,
        "section": "T1"
    }
    ```
*   **Expected Status:** `201 Created`
*   **Expected Response Body (JSON):**
    ```json
    {
        "success": true,
        "message": "Student added successfully",
        "data": { "_id": "...", "studentIdNumber": "TEST-001-NEW", ... }
    }
    ```
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function addStudent(studentData) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) { return Promise.reject('No auth token'); }

        try {
            const response = await axios.post(`${API_BASE_URL}/students`, studentData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('Add Student Response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Add Student Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }

    // const newStudent = {
    //     studentIdNumber: "FE-TEST-002",
    //     name: "Frontend Test Add",
    //     program: "BAB",
    //     yearLevel": 2
    // };
    // addStudent(newStudent).then(res => { /* ... */ }).catch(err => { /* ... */ });
    ```
*   **Test Failure Cases (for manual testing):**
    1.  Duplicate `studentIdNumber` (Status: `400`, Body: `{..., "error": { "message": "Student with ID ... already exists." } }`)
    2.  Missing Required Fields (Status: `400`, Body: `{..., "error": { "message": "Student Name is required" } }`)
    3.  Invalid `program` (Status: `400`, Body: `{..., "error": { "message": "Program must be one of: ..." } }`)
    4.  Invalid `yearLevel` for ACT (Status: `400`, Body: `{..., "error": { "message": "ACT program is only available for Year 1 and 2." } }`)
    5.  No Auth Token (Status: `401`)

**B. Get List of Students**
*   **Endpoint:** `GET YOUR_CODESPACE_URL/api/v1/students`
*   **Method:** `GET`
*   **Authorization:** Bearer Token
*   **Query Parameters (Optional):**
    *   `page` (number, e.g., `1`)
    *   `limit` (number, e.g., `10`)
    *   `program` (string, e.g., `BSIS`)
    *   `yearLevel` (number, e.g., `1`)
    *   `section` (string, e.g., `A`)
    *   `sortBy` (string, field name, e.g., `name`)
    *   `order` (string, `asc` or `desc`)
    *   `search` (string, search term for name/ID)
*   **Expected Status:** `200 OK`
*   **Expected Response Body (JSON):**
    ```json
    {
        "success": true,
        "count": 10, // Or actual count on page
        "pagination": { "currentPage": 1, "totalPages": ..., "limit": 10, "totalItems": ... },
        "data": [ /* array of student objects */ ]
    }
    ```
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getStudents(params = {}) { // params: { page, limit, program, search, etc. }
        const token = localStorage.getItem('adminAuthToken');
        if (!token) { return Promise.reject('No auth token'); }

        try {
            // Construct query string from params object
            const response = await axios.get(`${API_BASE_URL}/students`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params // Axios automatically converts this to query string
            });
            console.log('Get Students Response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Get Students Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }

    // Example usage:
    // getStudents({ page: 1, limit: 5, program: 'BSIS', sortBy: 'name', order: 'asc' })
    //     .then(res => { /* Use res.data and res.pagination */ })
    //     .catch(err => { /* ... */ });
    ```
*   **Test Variations (for manual testing):**
    1.  Pagination: `?page=2&limit=5`
    2.  Filtering: `?program=BSIS&yearLevel=1`
    3.  Sorting: `?sortBy=name&order=desc`
    4.  Searching: `?search=LastName`
    5.  Combined: `?program=ACT&yearLevel=1&sortBy=studentIdNumber&order=asc&page=1&limit=20`
*   **Test Failure Cases (for manual testing):**
    1.  No Auth Token (Status: `401`)

**C. Get Single Student by Database ID**

*   **Endpoint:** `GET YOUR_CODESPACE_URL/api/v1/students/:id`
    *   Replace `:id` with the actual MongoDB `_id` of the student.
*   **Method:** `GET`
*   **Authorization:** Bearer Token (Admin JWT)
*   **Purpose:** Retrieves the complete details of a single student record using their unique database identifier (`_id`). This is typically used when you have the `_id` (e.g., from a list view) and need to fetch or display the full record.
*   **Expected Status:**
    *   `200 OK` (If student found)
    *   `400 Bad Request` (If the provided `:id` is not a valid MongoDB ObjectId format)
    *   `404 Not Found` (If the `:id` is a valid format but no student exists with that ID)
    *   `401 Unauthorized` (If no valid token is provided)
*   **Expected Response Body (JSON - Success):**
    ```json
    {
        "success": true,
        "data": {
            "_id": "the_mongodb_object_id",
            "studentIdNumber": "2024-0001-FAK",
            "name": "FirstName LastName",
            "program": "BSIS",
            "yearLevel": 1,
            "section": "A",
            "profilePictureUrl": "/images/default-avatar.png",
            "createdAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
            "updatedAt": "YYYY-MM-DDTHH:mm:ss.sssZ"
            // Any other fields defined in the StudentModel
        }
    }
    ```
*   **Expected Response Body (JSON - Error, e.g., 404):**
    ```json
    {
        "success": false,
        "error": {
            "message": "Student not found with ID: <the_id_you_sent>",
            "stack": "..." // (in development)
        }
    }
    ```
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    // const API_BASE_URL = 'YOUR_CODESPACE_URL/api/v1';

    async function getStudentByDatabaseId(studentDatabaseId) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) {
            console.error('No auth token found. Please login.');
            return Promise.reject({ success: false, error: { message: 'Authentication token not found.' }});
        }
        if (!studentDatabaseId) {
            console.error('Student Database ID is required.');
            return Promise.reject({ success: false, error: { message: 'Student Database ID is required.' }});
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/students/${studentDatabaseId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log(`Get Student by DB ID (${studentDatabaseId}) Response:`, response.data);
            return response.data; // Contains { success: true, data: { ...student... } }
        } catch (error) {
            console.error(`Get Student by DB ID (${studentDatabaseId}) Error:`, error.response ? error.response.data : error.message);
            // error.response.data should contain { success: false, error: { message: '...' } }
            throw error.response ? error.response.data : new Error('Network error or server issue');
        }
    }

    // Example usage:
    // First, get a list of students to obtain a valid studentDatabaseId
    // getStudents({ limit: 1 }) // Assuming getStudents() is already defined as per previous guide
    //     .then(response => {
    //         if (response.success && response.data.length > 0) {
    //             const studentIdToFetch = response.data[0]._id;
    //             console.log(`Fetching details for student with _id: ${studentIdToFetch}`);
    //             return getStudentByDatabaseId(studentIdToFetch);
    //         } else {
    //             console.log('No students found to get an ID from.');
    //             return Promise.reject('No students available');
    //         }
    //     })
    //     .then(studentDetailsResponse => {
    //         if (studentDetailsResponse.success) {
    //             console.log('Specific Student Details:', studentDetailsResponse.data);
    //         }
    //     })
    //     .catch(err => {
    //         console.error('Error in fetching student by DB ID workflow:', err);
    //     });

    // Example with a non-existent (but valid format) ID:
    // getStudentByDatabaseId('60c72b2f9b1e8c001c8e4a00')
    //     .catch(err => console.log('Error for non-existent ID:', err));

    // Example with an invalid ID format:
    // getStudentByDatabaseId('invalidformat123')
    //     .catch(err => console.log('Error for invalid ID format:', err));
    ```
*   **Manual Testing Scenarios:**
    1.  **Valid ID:** Use an actual `_id` from your `students` collection.
    2.  **Invalid ID Format:** Use a string that is not a valid MongoDB ObjectId (e.g., "123", "test-id").
    3.  **Non-Existent Valid ID:** Use a correctly formatted MongoDB ObjectId that does not correspond to any student in your database.
    4.  **No Auth Token:** Attempt to access without the `Authorization` header.

---
