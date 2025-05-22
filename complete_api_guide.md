# API Testing Guide & Frontend Integration Examples

**Base URL for API:** `YOUR_LOCAL_URL/api/v1`
*(Replace `YOUR_LOCAL_URL` with `http://localhost:5001` or your actual local server address)*

**Authentication:** Most admin endpoints require a Bearer Token. Obtain this token by logging in.

---

## I. Health Check

*   **Endpoint:** `GET /health`
*   **Full URL:** `YOUR_LOCAL_URL/api/v1/health`
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
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js
    import axios from 'axios';

    const API_BASE_URL = 'YOUR_LOCAL_URL/api/v1'; // Replace with actual base URL

    async function checkHealth() {
        try {
            const response = await axios.get(`${API_BASE_URL}/health`);
            console.log('Health Check:', response.data);
        } catch (error) {
            console.error('Health Check Error:', error.response ? error.response.data : error.message);
        }
    }
    // checkHealth();
    ```

---

## II. Admin Authentication (`/auth`)

**A. Admin Login**
*   **Endpoint:** `POST /auth/login`
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
*   **Action:** Store the `token` for subsequent protected requests.
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    // let authToken = null; // Or manage in state

    async function loginAdmin(email, password) {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
            if (response.data.success && response.data.token) {
                localStorage.setItem('adminAuthToken', response.data.token);
                console.log('Admin logged in. Token stored.');
                return response.data;
            }
        } catch (error) {
            console.error('Login Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    // loginAdmin('admin@lvcc.edu.ph', 'password123');
    ```

**B. Get Admin Profile (Protected)**
*   **Endpoint:** `GET /auth/me`
*   **Method:** `GET`
*   **Authorization:** `Bearer <YOUR_ADMIN_JWT>`
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
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.get(`${API_BASE_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data.admin;
        } catch (error) {
            console.error('Get Profile Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    // getAdminProfile().then(admin => console.log('Profile:', admin));
    ```

**C. Admin Logout (Protected)**
*   **Endpoint:** `POST /auth/logout`
*   **Method:** `POST`
*   **Authorization:** `Bearer <YOUR_ADMIN_JWT>`
*   **Request Body:** None (or empty JSON `{}`)
*   **Expected Status:** `200 OK`
*   **Expected Response Body (JSON):**
    ```json
    {
        "success": true,
        "message": "Admin logged out successfully. Please clear token on client-side."
    }
    ```
*   **Important for Frontend:** Upon receiving a successful response, the client **MUST** delete the stored JWT to complete the logout process.
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function logoutAdmin() {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) {
            console.warn('Already logged out client-side.');
            return Promise.resolve({ success: true, message: "Already logged out client-side." });
        }
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            localStorage.removeItem('adminAuthToken');
            console.log('Logout successful, token removed.');
            return response.data;
        } catch (error) {
            console.error('Logout Error:', error.response ? error.response.data : error.message);
            localStorage.removeItem('adminAuthToken'); // Attempt to clear token even on error
            throw error.response ? error.response.data : error;
        }
    }
    // logoutAdmin();
    ```

---

## III. Student Management (`/students`)

*(All routes require Admin Authentication: `Authorization: Bearer <YOUR_ADMIN_JWT>`)*

**A. Add New Student**
*   **Endpoint:** `POST /students`
*   **Request Body (JSON):**
    ```json
    {
        "studentIdNumber": "UNIQUE-ID-001",
        "name": "Juan Dela Cruz",
        "program": "BSIS",
        "yearLevel": 1,
        "section": "A",
        "profilePictureUrl": "/images/default.png" // Optional
    }
    ```
*   **Expected Status:** `201 Created`
*   **Expected Response:** `{ "success": true, "message": "Student added successfully", "data": { ...new student object... } }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function addStudent(studentData) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.post(`${API_BASE_URL}/students`, studentData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Add Student Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**B. Get List of Students**
*   **Endpoint:** `GET /students`
*   **Query Parameters (Optional):** `page`, `limit`, `program`, `yearLevel`, `section`, `sortBy`, `order`, `search`
*   **Example URL:** `YOUR_LOCAL_URL/api/v1/students?program=BSIS&page=1&limit=10&sortBy=name`
*   **Expected Status:** `200 OK`
*   **Expected Response:** `{ "success": true, "count": ..., "pagination": { ... }, "data": [ ...student objects... ] }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getStudents(params = {}) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.get(`${API_BASE_URL}/students`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            return response.data;
        } catch (error) {
            console.error('Get Students Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**C. Get Single Student by Database ID**
*   **Endpoint:** `GET /students/:id` (replace `:id` with student's MongoDB `_id`)
*   **Expected Status:** `200 OK` (if found), `404 Not Found`, `400 Bad Request` (invalid ID format)
*   **Expected Response (Success):** `{ "success": true, "data": { ...student object... } }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getStudentByDatabaseId(studentDatabaseId) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.get(`${API_BASE_URL}/students/${studentDatabaseId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Get Student by ID Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**D. Partially Update Student by Database ID**
*   **Endpoint:** `PATCH /students/:id` (replace `:id` with student's MongoDB `_id`)
*   **Request Body (JSON):** Send only the fields to update.
    ```json
    {
        "yearLevel": 2,
        "section": "B-UPDATED"
    }
    ```
*   **Expected Status:** `200 OK` (if successful), `404 Not Found`, `400 Bad Request` (validation error)
*   **Expected Response (Success):** `{ "success": true, "message": "Student updated successfully", "data": { ...updated student object... } }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function updateStudent(studentDatabaseId, updateData) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.patch(`${API_BASE_URL}/students/${studentDatabaseId}`, updateData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Update Student Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**E. Delete Student by Database ID**
*   **Endpoint:** `DELETE /students/:id` (replace `:id` with student's MongoDB `_id`)
*   **Expected Status:** `200 OK` (if successful), `404 Not Found`, `400 Bad Request` (invalid ID format)
*   **Expected Response (Success):** `{ "success": true, "message": "Student ... deleted successfully.", "data": {} }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function deleteStudentById(studentDatabaseId) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.delete(`${API_BASE_URL}/students/${studentDatabaseId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Delete Student Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

---

## IV. Schedule Management (`/schedules`)

*(All routes require Admin Authentication: `Authorization: Bearer <YOUR_ADMIN_JWT>`)*

**A. Add/Update Schedule Entries for a Program/Year**
*   **Endpoint:** `POST /schedules`
*   **Request Body (JSON):**
    ```json
    {
        "program": "BSIS",
        "yearLevel": 1,
        "scheduleDays": [
            { "dayOfWeek": "Monday", "isEligible": true },
            { "dayOfWeek": "Tuesday", "isEligible": false },
            { "dayOfWeek": "Wednesday", "isEligible": true }
        ]
    }
    ```
*   **Expected Status:** `201 Created` (or `200 OK` if only updates occurred due to upsert)
*   **Expected Response:** `{ "success": true, "message": "Schedule entries processed...", "data": [ ...created/updated daily schedule entries... ], "errors": [...] }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function setProgramYearSchedule(scheduleData) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.post(`${API_BASE_URL}/schedules`, scheduleData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Set Schedule Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**B. Get Schedules**
*   **Endpoint:** `GET /schedules`
*   **Query Parameters (Optional):**
    *   If `program` AND `yearLevel` are provided (e.g., `?program=BSIS&yearLevel=1`):
        *   **Expected Response:** `{ "success": true, "program": "BSIS", "yearLevel": 1, "weeklySchedule": { "Monday": "Eligible", ... }, "_idsPerDay": { "Monday": "...", ... } }`
    *   Otherwise (e.g., `?program=BSIS` or `?dayOfWeek=Monday` or no params):
        *   **Expected Response:** `{ "success": true, "count": ..., "data": [ ...flat list of daily schedule entries... ] }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getSchedules(params = {}) { // e.g., { program: 'BSIS', yearLevel: 1 } or { program: 'BSIT' }
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.get(`${API_BASE_URL}/schedules`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            return response.data;
        } catch (error) {
            console.error('Get Schedules Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**C. Update a Specific Daily Schedule Entry**
*   **Endpoint:** `PUT /schedules/:id` (replace `:id` with the `_id` of a specific daily schedule entry, e.g., from `_idsPerDay`)
*   **Request Body (JSON):**
    ```json
    {
        "isEligible": false // or true
    }
    ```
*   **Expected Status:** `200 OK`
*   **Expected Response:** `{ "success": true, "message": "Schedule entry updated...", "data": { ...updated daily schedule entry... } }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function updateDailySchedule(dailyScheduleEntryId, newEligibilityStatus) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.put(`${API_BASE_URL}/schedules/${dailyScheduleEntryId}`,
                { isEligible: newEligibilityStatus },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            console.error('Update Daily Schedule Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**D. Delete a Specific Daily Schedule Entry**
*   **Endpoint:** `DELETE /schedules/:id` (replace `:id` with the `_id` of a specific daily schedule entry)
*   **Expected Status:** `200 OK`
*   **Expected Response:** `{ "success": true, "message": "Schedule entry ... deleted successfully.", "data": {} }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function deleteDailySchedule(dailyScheduleEntryId) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.delete(`${API_BASE_URL}/schedules/${dailyScheduleEntryId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error('Delete Daily Schedule Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

---

## V. Kitchen Staff Eligibility Check (`/eligibility`)

*   **Endpoint:** `GET /eligibility/:studentIdNumber`
*   **Method:** `GET`
*   **Authorization:** Requires an API Key in the header.
    *   Header Name: `x-api-key`
    *   Header Value: `YOUR_KITCHEN_STAFF_API_KEY` (This key needs to be provided to the frontend)
*   **Expected Status:** `200 OK` (for processed checks), `404 Not Found` (if student ID is valid format but not found - controller returns structured JSON), `401 Unauthorized` (missing/invalid API key).
*   **Expected Response Body (JSON - Success/Ineligible):**
    ```json
    {
        "success": true, // or false if student not found by controller but still 200 from API GW / 404 from Express
        "studentInfo": {
            "studentIdNumber": "...", "name": "...", "program": "...", "year": ..., ...
        },
        "eligibilityStatus": true, // or false
        "reason": "Eligible for meal." // or "Not scheduled..." or "Student ID not found..."
    }
    ```
*   **Axios Example (Frontend - Kitchen Staff App):**
    ```javascript
    // kitchenApp.js
    import axios from 'axios';
    const API_BASE_URL = 'YOUR_LOCAL_URL/api/v1';
    const KITCHEN_API_KEY = 'YOUR_ACTUAL_KITCHEN_STAFF_API_KEY'; // This should be securely configured

    async function checkStudentEligibilityForMeal(studentIdNumber) {
        if (!studentIdNumber) return Promise.reject('Student ID Number is required.');
        try {
            const response = await axios.get(`${API_BASE_URL}/eligibility/${studentIdNumber}`, {
                headers: { 'x-api-key': KITCHEN_API_KEY }
            });
            return response.data;
        } catch (error) {
            console.error('Eligibility Check Error:', error.response ? error.response.data : error.message);
            if (error.response && error.response.data) return error.response.data; // Return structured error from backend
            throw error;
        }
    }
    // checkStudentEligibilityForMeal('STUDENT_ID_TO_CHECK');
    ```

---

## VI. Meal Record Viewing (Admin) (`/meal-records`)

*(Requires Admin Authentication: `Authorization: Bearer <YOUR_ADMIN_JWT>`)*

*   **Endpoint:** `GET /meal-records`
*   **Query Parameters (Optional):** `studentId` (MongoDB `_id`), `startDate`, `endDate`, `month` (YYYY-MM), `status`, `searchStudentName`, `page`, `limit`, `sortBy`, `order`
*   **Expected Status:** `200 OK`
*   **Expected Response:** `{ "success": true, "count": ..., "pagination": { ... }, "data": [ ...meal record objects with populated student info... ] }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getMealRecords(params = {}) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        try {
            const response = await axios.get(`${API_BASE_URL}/meal-records`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            return response.data;
        } catch (error) {
            console.error('Get Meal Records Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

---

## VII. Dashboard Analytics (`/dashboard`)

*(All routes require Admin Authentication: `Authorization: Bearer <YOUR_ADMIN_JWT>`)*

**A. Performance Summary**
*   **Endpoint:** `GET /dashboard/summary`
*   **Query Parameters:** `filterPeriod` (required: 'daily', 'weekly', 'monthly', 'semestral'), `value` (optional: specific date/week/month/semester identifier based on `filterPeriod`)
*   **Expected Status:** `200 OK`
*   **Expected Response:** `{ "success": true, "filterDetails": { ... }, "data": { "name": "...", "allotted": ..., "claimed": ..., "unclaimed": ..., "claimedRatio": ..., "unclaimedRatio": ... } }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getDashboardSummary(filterPeriod, value = null) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        const params = { filterPeriod };
        if (value) params.value = value;
        try {
            const response = await axios.get(`${API_BASE_URL}/dashboard/summary`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            return response.data;
        } catch (error) {
            console.error('Dashboard Summary Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

**B. Program Breakdown**
*   **Endpoint:** `GET /dashboard/program-breakdown`
*   **Query Parameters:** `filterPeriod` (required), `value` (optional) - same as `/summary`.
*   **Expected Status:** `200 OK`
*   **Expected Response:** `{ "success": true, "filterDetails": { ... }, "data": [ { "program": "...", "allotted": ..., "claimed": ..., ...ratios... }, ... ] }`
*   **Axios Example (Frontend):**
    ```javascript
    // frontend.js (continued)
    async function getDashboardProgramBreakdown(filterPeriod, value = null) {
        const token = localStorage.getItem('adminAuthToken');
        if (!token) return Promise.reject('No auth token');
        const params = { filterPeriod };
        if (value) params.value = value;
        try {
            const response = await axios.get(`${API_BASE_URL}/dashboard/program-breakdown`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: params
            });
            return response.data;
        } catch (error) {
            console.error('Dashboard Program Breakdown Error:', error.response ? error.response.data : error.message);
            throw error.response ? error.response.data : error;
        }
    }
    ```

---