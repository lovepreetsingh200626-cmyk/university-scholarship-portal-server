const express = require('express');

const {
    createApplication,
    getMyApplications,
    getApplicationById,
    downloadApplicationPdf,
    getApplicationDocumentUrl,
    updateApplication,
    uploadApplicationDocument,
    submitApplication
} = require('../controllers/applicationController');

const {
    protect
} = require('../middleware/authMiddleware');

const upload =
    require('../middleware/uploadMiddleware');

const router = express.Router();


/* ============================================================
   CREATE APPLICATION
============================================================ */

router.post(
    '/',
    protect,
    createApplication
);


/* ============================================================
   GET MY APPLICATIONS
============================================================ */

router.get(
    '/my',
    protect,
    getMyApplications
);


/* ============================================================
   GET SECURE APPLICATION DOCUMENT URL
============================================================ */

router.get(
    '/:id/documents/:documentId',
    protect,
    getApplicationDocumentUrl
);

router.get(
    '/:id/pdf',
    protect,
    downloadApplicationPdf
);


/* ============================================================
   GET APPLICATION BY ID
============================================================ */

router.get(
    '/:id',
    protect,
    getApplicationById
);


/* ============================================================
   UPDATE APPLICATION
============================================================ */

router.put(
    '/:id',
    protect,
    updateApplication
);


/* ============================================================
   UPLOAD APPLICATION DOCUMENT
============================================================ */

router.post(
    '/:id/documents',
    protect,
    (req, res, next) => {
        upload.single('document')(
            req,
            res,
            (error) => {

                if (error) {
                    console.error(
                        '=============================================='
                    );

                    console.error(
                        ' MULTER DOCUMENT UPLOAD ERROR'
                    );

                    console.error(
                        '=============================================='
                    );

                    console.error(
                        'Code:',
                        error.code
                    );

                    console.error(
                        'Message:',
                        error.message
                    );

                    console.error(
                        'Field:',
                        error.field
                    );

                    console.error(
                        '=============================================='
                    );

                    if (
                        error.code ===
                        'LIMIT_FILE_SIZE'
                    ) {
                        return res.status(400).json({
                            success: false,
                            message:
                                'File size must not exceed 5 MB.'
                        });
                    }

                    return res.status(400).json({
                        success: false,
                        message:
                            error.message ||
                            'Document upload failed.'
                    });
                }

                next();
            }
        );
    },
    uploadApplicationDocument
);


/* ============================================================
   SUBMIT APPLICATION
============================================================ */

router.post(
    '/:id/submit',
    protect,
    submitApplication
);


module.exports = router;
