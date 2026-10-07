const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { searchInstitutions } = require('../utils/institutionDirectory');

const router = express.Router();

router.get('/search', protect, (req, res, next) => {
    if (req.user?.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Student access is required.' });
    }
    return next();
}, searchInstitutions);

module.exports = router;
