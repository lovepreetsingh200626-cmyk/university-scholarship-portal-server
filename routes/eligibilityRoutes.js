const express = require('express');

const {
    checkEligibility
} = require('../controllers/eligibilityController');

const {
    protect
} = require('../middleware/authMiddleware');

const router = express.Router();

/* ============================================================
   ELIGIBILITY ROUTES
============================================================ */

router.get(
    '/:scholarshipId',
    protect,
    checkEligibility
);

module.exports = router;