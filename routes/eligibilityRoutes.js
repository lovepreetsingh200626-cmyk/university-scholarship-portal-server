const express = require('express');

const {
    checkEligibility
} = require('../controllers/eligibilityController');

const {
    protect
} = require('../middleware/authMiddleware');

const router = express.Router();


/* ============================================================
   CHECK SCHOLARSHIP ELIGIBILITY

   Logged-in students can check their own eligibility.
============================================================ */

router.get(
    '/:scholarshipId',
    protect,
    checkEligibility
);


module.exports = router;