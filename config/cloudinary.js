const {
    v2: cloudinary
} = require('cloudinary');


/* ============================================================
   REQUIRED CLOUDINARY ENVIRONMENT VARIABLES
============================================================ */

const requiredVariables = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];


/* ============================================================
   CONFIGURATION VALIDATION
============================================================ */

const missingVariables =
    requiredVariables.filter(
        (variable) => {
            return (
                !process.env[variable] ||
                typeof process.env[variable] !== 'string' ||
                !process.env[variable].trim()
            );
        }
    );


if (missingVariables.length > 0) {

    throw new Error(
        `Cloudinary configuration is incomplete. Missing environment variables: ${missingVariables.join(', ')}`
    );
}


/* ============================================================
   CLOUDINARY CONFIGURATION
============================================================ */

cloudinary.config({
    cloud_name:
        process.env.CLOUDINARY_CLOUD_NAME.trim(),

    api_key:
        process.env.CLOUDINARY_API_KEY.trim(),

    api_secret:
        process.env.CLOUDINARY_API_SECRET.trim(),

    secure: true
});


/* ============================================================
   EXPORT
============================================================ */

module.exports = cloudinary;