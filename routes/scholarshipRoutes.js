const express = require('express');

const {
    createScholarship,
    getAllScholarships,
    getScholarshipById,
    updateScholarship,
    deleteScholarship
} = require('../controllers/scholarshipController');

const {
    protect,
    adminOnly
} = require('../middleware/authMiddleware');

const router = express.Router();


/* ============================================================
   GET ALL SCHOLARSHIPS

   Logged-in students and admins can view scholarships.
============================================================ */

router.get(
    '/',
    protect,
    getAllScholarships
);


/* ============================================================
   GET SINGLE SCHOLARSHIP

   Logged-in students and admins can view a scholarship.
============================================================ */

router.get(
    '/:id',
    protect,
    getScholarshipById
);


/* ============================================================
   CREATE SCHOLARSHIP

   ADMIN ONLY
============================================================ */

router.post(
    '/',
    protect,
    adminOnly,
    createScholarship
);


/* ============================================================
   UPDATE SCHOLARSHIP

   ADMIN ONLY
============================================================ */

router.put(
    '/:id',
    protect,
    adminOnly,
    updateScholarship
);


/* ============================================================
   DELETE SCHOLARSHIP

   ADMIN ONLY
============================================================ */

router.delete(
    '/:id',
    protect,
    adminOnly,
    deleteScholarship
);


module.exports = router;