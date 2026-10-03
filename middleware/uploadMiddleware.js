const multer = require('multer');
const path = require('path');
const fs = require('fs');

/* ============================================================
   UPLOAD DIRECTORY
============================================================ */

const uploadDirectory = path.join(
    __dirname,
    '../uploads/scholarships'
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(
        uploadDirectory,
        {
            recursive: true
        }
    );
}

/* ============================================================
   STORAGE
============================================================ */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        const extension =
            path.extname(file.originalname)
                .toLowerCase();

        const uniqueName =
            `${Date.now()}-${Math.round(
                Math.random() * 1000000000
            )}${extension}`;

        cb(null, uniqueName);
    }
});

/* ============================================================
   FILE FILTER
============================================================ */

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png'
    ];

    if (
        allowedMimeTypes.includes(
            file.mimetype
        )
    ) {
        cb(null, true);
    } else {
        cb(
            new Error(
                'Only PDF, JPG and PNG files are allowed.'
            )
        );
    }
};

/* ============================================================
   MULTER CONFIGURATION
============================================================ */

const upload = multer({
    storage,

    fileFilter,

    limits: {
        fileSize:
            5 * 1024 * 1024
    }
});

module.exports = upload;