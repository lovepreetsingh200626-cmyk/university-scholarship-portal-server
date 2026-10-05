const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        /* ========================================================
           BASIC IDENTITY
        ======================================================== */

        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100
        },

        /*
           Student login ID.

           This is generated automatically during
           student registration.

           Admin accounts do not require a studentId.

           unique + sparse means:
           - Every studentId must be unique.
           - Multiple admin accounts can exist without
             a studentId.
        */

        studentId: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            uppercase: true,
            minlength: 4,
            maxlength: 30
        },

        /* ========================================================
           EMAIL
        ======================================================== */

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
            index: true
        },

        /* ========================================================
           PASSWORD
        ======================================================== */

        password: {
            type: String,
            required: true,
            minlength: 1,
            maxlength: 200
        },

        mustChangePassword: {
            type: Boolean,
            default: false
        },

        /* ========================================================
           ROLE
        ======================================================== */

        role: {
            type: String,
            enum: ['student', 'admin'],
            default: 'student',
            index: true
        },

        /* ========================================================
           MOBILE
        ======================================================== */

        mobile: {
            type: String,
            trim: true,
            maxlength: 10,
            default: ''
        },

        passwordResetOTPHash: {
            type: String,
            select: false,
            default: ''
        },

        passwordResetOTPExpiresAt: {
            type: Date,
            select: false,
            default: null
        },

        passwordResetOTPAttempts: {
            type: Number,
            select: false,
            default: 0
        },

        passwordResetOTPSentAt: {
            type: Date,
            select: false,
            default: null
        },

        /* ========================================================
           ACCOUNT STATUS
        ======================================================== */

        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        timestamps: true,
        strict: true
    }
);


/* ================================================================
   USER INDEXES
================================================================ */

/*
   Useful for filtering users by role and account status.

   Example:
   - active students
   - inactive students
   - active admins
   - inactive admins
*/

userSchema.index({
    role: 1,
    isActive: 1
});


/* ================================================================
   MODEL
================================================================ */

const User = mongoose.model(
    'User',
    userSchema
);

module.exports = User;
