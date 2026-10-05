const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    registerStudent,
    login,
    changePassword,
    requestPasswordReset,
    resetPasswordWithOTP
} = require('../controllers/authController');

const {
    protect
} = require('../middleware/authMiddleware');

const router = express.Router();


/* ============================================================
   REGISTRATION RATE LIMITER
============================================================ */

/*
   Prevents automated account creation.

   Maximum:
   10 registration attempts per hour
   from the same IP address.
*/

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message:
            'Too many registration attempts. Please try again later.'
    }
});


/* ============================================================
   LOGIN RATE LIMITER
============================================================ */

/*
   Prevents brute-force password attacks.

   Maximum:
   10 login attempts every 15 minutes
   from the same IP address.
*/

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message:
            'Too many login attempts. Please try again after 15 minutes.'
    }
});


/* ============================================================
   PASSWORD CHANGE RATE LIMITER
============================================================ */

/*
   Prevents repeated automated password-change attempts.

   Maximum:
   5 password-change attempts every 15 minutes
   from the same IP address.
*/

const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,

    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message:
            'Too many password change attempts. Please try again later.'
    }
});

const passwordResetRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many recovery requests. Please try again later.' }
});

const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many password reset attempts. Please try again later.' }
});


/* ============================================================
   STUDENT REGISTRATION
============================================================ */

router.post(
    '/register',
    registerLimiter,
    registerStudent
);


/* ============================================================
   LOGIN
============================================================ */

router.post(
    '/login',
    loginLimiter,
    login
);

router.post(
    '/forgot-password',
    passwordResetRequestLimiter,
    requestPasswordReset
);

router.post(
    '/reset-password',
    passwordResetLimiter,
    resetPasswordWithOTP
);


/* ============================================================
   CHANGE PASSWORD
============================================================ */

/*
   User must already be authenticated.

   The current password is verified before the new
   password is saved.
*/

router.post(
    '/change-password',
    protect,
    changePasswordLimiter,
    changePassword
);


/* ============================================================
   EXPORT
============================================================ */

module.exports = router;
