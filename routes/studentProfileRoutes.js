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
   STUDENT PROFILE ROUTES
============================================================ */

router.get(
    '/me',
    protect,
    getMyProfile
);

router.post(
    '/me',
    protect,
    createOrUpdateProfile
);

module.exports = router;
router.get(
    '/test',
    (req, res) => {
        return res.status(200).json({
            success: true,
            message: 'Student profile route is working.'
        });
    }
);