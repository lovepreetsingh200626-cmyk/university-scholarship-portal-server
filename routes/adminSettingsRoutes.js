const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword,
    createAdminAccount
} = require('../controllers/adminSettingsController');

const {
    protect,
    adminOnly
} = require('../middleware/authMiddleware');


const router = express.Router();
const adminCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many administrator creation attempts. Try again later.' }
});


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

router.post(
    '/admins',
    protect,
    adminOnly,
    adminCreationLimiter,
    createAdminAccount
);


module.exports = router;
