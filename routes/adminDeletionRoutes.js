const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { requestAdminDeletion, confirmAdminDeletion } = require('../controllers/adminDeletionController');

const router = express.Router();
const deletionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many deletion confirmation attempts. Try again later.' }
});

router.post('/request', protect, adminOnly, deletionLimiter, requestAdminDeletion);
router.post('/confirm', protect, adminOnly, deletionLimiter, confirmAdminDeletion);

module.exports = router;
