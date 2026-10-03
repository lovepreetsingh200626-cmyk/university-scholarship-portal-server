const express = require('express');

const {
    registerStudent,
    login
} = require('../controllers/authController');

const router = express.Router();

/* ============================================================
   STUDENT REGISTRATION
============================================================ */

router.post('/register', registerStudent);

/* ============================================================
   LOGIN
============================================================ */

router.post('/login', login);

module.exports = router;