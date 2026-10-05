const express = require('express');
const upload = require('../middleware/uploadMiddleware');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
    getMyApplication,
    saveMyApplication,
    uploadDocument,
    submitApplication,
    downloadApplicationPerforma,
    downloadApprovedCard,
    getDocument,
    getAllForAdmin,
    getOneForAdmin,
    reviewForAdmin
} = require('../controllers/freeshipCardController');

const router = express.Router();

const studentOnly = (req, res, next) => {
    if (req.user?.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Student access is required.' });
    }
    return next();
};

router.get('/admin', protect, adminOnly, getAllForAdmin);
router.get('/admin/:id', protect, adminOnly, getOneForAdmin);
router.put('/admin/:id/:action', protect, adminOnly, reviewForAdmin);

router.get('/me', protect, studentOnly, getMyApplication);
router.get('/me/performa.pdf', protect, studentOnly, downloadApplicationPerforma);
router.get('/me/card.pdf', protect, studentOnly, downloadApprovedCard);
router.post('/me', protect, studentOnly, saveMyApplication);
router.get('/:id/documents/:documentType', protect, getDocument);
router.post('/:id/documents', protect, studentOnly, (req, res, next) => {
    upload.single('document')(req, res, (error) => {
        if (!error) return next();
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File must be 125 KB or smaller.' });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ success: false, message: 'Upload a PDF, JPG, or PNG document.' });
        }
        return res.status(400).json({ success: false, message: error.message || 'Document upload failed.' });
    });
}, uploadDocument);
router.post('/:id/submit', protect, studentOnly, submitApplication);

module.exports = router;
