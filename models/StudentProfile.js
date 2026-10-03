const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },

        fullName: {
            type: String,
            required: true,
            trim: true
        },

        registrationNumber: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },

        course: {
            type: String,
            required: true,
            trim: true
        },

        department: {
            type: String,
            required: true,
            trim: true
        },

        academicYear: {
            type: String,
            required: true,
            trim: true
        },

        currentSemester: {
            type: Number,
            required: true,
            min: 1
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        gender: {
            type: String,
            trim: true,
            default: ''
        },

        dateOfBirth: {
            type: Date,
            default: null
        },

        mobile: {
            type: String,
            trim: true,
            default: ''
        },

        address: {
            type: String,
            trim: true,
            default: ''
        },

        state: {
            type: String,
            trim: true,
            default: ''
        },

        familyIncome: {
            type: Number,
            default: null,
            min: 0
        },

        previousPercentage: {
            type: Number,
            default: null,
            min: 0,
            max: 100
        },

        previousQualification: {
            type: String,
            trim: true,
            default: ''
        },

        bankAccountNumber: {
            type: String,
            trim: true,
            default: ''
        },

        bankName: {
            type: String,
            trim: true,
            default: ''
        },

        ifscCode: {
            type: String,
            trim: true,
            default: ''
        },

        profileCompleted: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

/*
   user already has unique: true.
   registrationNumber already has unique: true.

   Therefore, separate indexes for these fields
   are not required.
*/

const StudentProfile = mongoose.model(
    'StudentProfile',
    studentProfileSchema
);

module.exports = StudentProfile;