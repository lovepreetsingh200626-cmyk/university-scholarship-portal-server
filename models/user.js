const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
            index: true
        },

        password: {
            type: String,
            required: true,
            minlength: 1,
            maxlength: 200
        },

        role: {
            type: String,
            enum: ['student', 'admin'],
            default: 'student',
            index: true
        },

        mobile: {
            type: String,
            trim: true,
            maxlength: 10,
            default: ''
        },

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


/* ============================================================
   USER INDEXES
============================================================ */

/*
   Email is already unique, so MongoDB will maintain
   a unique index for it.
*/

userSchema.index({
    role: 1,
    isActive: 1
});


/* ============================================================
   MODEL
============================================================ */

const User = mongoose.model(
    'User',
    userSchema
);

module.exports = User;