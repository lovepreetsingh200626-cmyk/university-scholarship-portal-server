const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    registerStudent,
    login
} = require('../controllers/authController');

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


/* ============================================================
   EXPORT
============================================================ */

module.exports = router;