const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const {
    loginAdmin,
    getAdminProfile,
    logoutAdmin,
    requestPasswordReset,
    resetPasswordWithCode,
    googleLogin,
    changePassword
} = require('../controllers/authController');
const router = express.Router();


router.post('/login', loginAdmin);
router.post('/google-login', googleLogin);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPasswordWithCode);

router.use(protect); // Protect all routes below this middleware
router.get('/me', getAdminProfile);
router.post('/logout', logoutAdmin);
router.put('/change-password', changePassword); 

module.exports = router;