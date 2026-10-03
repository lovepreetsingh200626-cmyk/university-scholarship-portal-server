const express = require('express');

const {
    getDashboardStatistics
} = require('../controllers/adminDashboardController');

const {
    protect,
    adminOnly
} = require('../middleware/authMiddleware');

const router = express.Router();

/* ============================================================
   ADMIN DASHBOARD
============================================================ */

router.get(
    '/dashboard',
    protect,
    adminOnly,
    getDashboardStatistics
);

/* ============================================================
   ADMIN ROUTES
============================================================ */

/*
   Initial admin setup has been completed.

   Admin accounts should no longer be created through
   a public API endpoint.
*/

module.exports = router;