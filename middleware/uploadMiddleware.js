const multer = require('multer');


/* ============================================================
   ALLOWED FILE TYPES
============================================================ */

const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png'
];


/* ============================================================
   MAXIMUM FILE SIZE
============================================================ */

const MAX_FILE_SIZE =
    5 * 1024 * 1024;


/* ============================================================
   FILE FILTER
============================================================ */

const fileFilter = (
    req,
    file,
    cb
) => {

    /*
       Only allow the MIME types supported
       by the scholarship document system.

       The actual file content is additionally
       verified later in applicationController.js
       using file signatures.

       Therefore MIME type alone is NOT trusted.
    */

    if (
        allowedMimeTypes.includes(
            file.mimetype
        )
    ) {
        return cb(
            null,
            true
        );
    }

    return cb(
        new multer.MulterError(
            'LIMIT_UNEXPECTED_FILE',
            file.fieldname
        )
    );
};


/* ============================================================
   MEMORY STORAGE
============================================================ */

/*
   We intentionally use memoryStorage().

   The uploaded file temporarily exists
   in memory as:

       req.file.buffer

   The application controller validates the
   actual file signature and then uploads the
   file directly to authenticated Cloudinary
   storage.

   No permanent local file is created.

   This is suitable for Vercel serverless
   deployment.
*/

const storage =
    multer.memoryStorage();


/* ============================================================
   MULTER CONFIGURATION
============================================================ */

const upload = multer({

    storage,

    fileFilter,

    limits: {

        /*
           Maximum individual file size:

           5 MB
        */

        fileSize:
            MAX_FILE_SIZE,

        /*
           Only one document may be uploaded
           in a single request.
        */

        files: 1,

        /*
           Prevent requests containing a large
           number of multipart fields.
        */

        fields: 10,

        /*
           Prevent excessively large field names.
        */

        fieldNameSize: 100,

        /*
           Prevent excessively large text fields.
        */

        fieldSize: 10 * 1024
    }
});


/* ============================================================
   EXPORT
============================================================ */

module.exports = upload;