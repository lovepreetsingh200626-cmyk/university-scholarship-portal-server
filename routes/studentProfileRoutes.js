const express = require('express');

const {
    createOrUpdateProfile,
    getMyProfile
} = require('../controllers/studentProfileController');

const {
    protect
} = require('../middleware/authMiddleware');

const router = express.Router();


/* ============================================================
   GET MY STUDENT PROFILE

   Authenticated student only.
============================================================ */

router.get(
    '/me',
    protect,
    getMyProfile
);


/* ============================================================
   CREATE OR UPDATE MY STUDENT PROFILE

   Authenticated student only.

   The controller uses req.user.id, so a student
   cannot choose another user's profile ID.
============================================================ */

router.post(
    '/me',
    protect,
    createOrUpdateProfile
);


module.exports = router;