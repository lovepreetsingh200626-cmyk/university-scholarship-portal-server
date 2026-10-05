const express = require('express');

const {
    getAllApplicationsForAdmin,
    getApplicationByIdForAdmin,
    startVerification,
    requestCorrection,
    verifyApplication,
    rejectApplication
} = require('../controllers/adminApplicationController');

const {
    sanctionApplication
} = require('../controllers/adminSanctionController');

const {
    disburseApplication
} = require('../controllers/adminDisbursementController');

const {
    protect,
    adminOnly
} = require('../middleware/authMiddleware');

const router = express.Router();

/* ============================================================
   ADMIN SCHOLARSHIP APPLICATION ROUTES
============================================================ */

/*
   Get all scholarship applications
*/

router.get(
    '/',
    protect,
    adminOnly,
    getAllApplicationsForAdmin
);

/*
   Get one scholarship application
*/

router.get(
    '/:id',
    protect,
    adminOnly,
    getApplicationByIdForAdmin
);

/*
   Start application verification

   SUBMITTED or RESUBMITTED
        ↓
   UNDER VERIFICATION
*/

router.put(
    '/:id/start-verification',
    protect,
    adminOnly,
    startVerification
);

/*
   Request correction

   UNDER VERIFICATION
        ↓
   CORRECTION REQUIRED
*/

router.put(
    '/:id/request-correction',
    protect,
    adminOnly,
    requestCorrection
);

/*
   Verify application

   UNDER VERIFICATION
        ↓
   VERIFIED
*/

router.put(
    '/:id/verify',
    protect,
    adminOnly,
    verifyApplication
);

/*
   Reject application

   UNDER VERIFICATION
        ↓
   REJECTED
*/

router.put(
    '/:id/reject',
    protect,
    adminOnly,
    rejectApplication
);

/*
   Sanction application

   VERIFIED
        ↓
   SANCTIONED
*/

router.put(
    '/:id/sanction',
    protect,
    adminOnly,
    sanctionApplication
);

/*
   Disburse application

   SANCTIONED
        ↓
   DISBURSED
*/

router.put(
    '/:id/disburse',
    protect,
    adminOnly,
    disburseApplication
);

module.exports = router;
