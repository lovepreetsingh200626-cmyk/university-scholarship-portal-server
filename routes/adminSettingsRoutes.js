const express = require('express');

const {
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword
} = require('../controllers/adminSettingsController');

const {
    protect,
    adminOnly
} = require('../middleware/authMiddleware');


const router = express.Router();


/* ============================================================
   ADMIN SETTINGS ROUTES
============================================================ */


/*
   GET /api/admin/settings/profile

   Get the currently logged-in admin profile.
*/

router.get(
    '/profile',
    protect,
    adminOnly,
    getAdminProfile
);


/*
   PUT /api/admin/settings/profile

   Update admin name, email and mobile number.
*/

router.put(
    '/profile',
    protect,
    adminOnly,
    updateAdminProfile
);


/*
   PUT /api/admin/settings/password

   Change the admin password.
*/

router.put(
    '/password',
    protect,
    adminOnly,
    changeAdminPassword
);


module.exports = router;