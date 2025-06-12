const express = require('express');
const { getMealRecords, generateUnclaimedRecords } = require('../controllers/recordController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .get(protect, getMealRecords);

router.route('/generate-unclaimed')
    .post(protect, generateUnclaimedRecords);

module.exports = router;