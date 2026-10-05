const mongoose = require('mongoose');


/* ============================================================
   STUDENT PROFILE SCHEMA
============================================================ */

const studentProfileSchema =
    new mongoose.Schema(
        {

            /* ----------------------------------------------------
               USER REFERENCE
            ---------------------------------------------------- */

            user: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
                unique: true
            },


            /* ----------------------------------------------------
               BASIC ACADEMIC INFORMATION
            ---------------------------------------------------- */

            fullName: {
                type: String,
                required: true,
                trim: true,
                minlength: 2,
                maxlength: 100
            },

            registrationNumber: {
                type: String,
                required: true,
                trim: true,
                unique: true,
                maxlength: 50
            },

            course: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100
            },

            department: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100
            },

            academicYear: {
                type: String,
                required: true,
                trim: true,
                maxlength: 20
            },

            currentSemester: {
                type: Number,
                required: true,
                min: 1,
                max: 20
            },

            category: {
                type: String,
                required: true,
                trim: true,
                maxlength: 50
            },


            /* ----------------------------------------------------
               PERSONAL INFORMATION
            ---------------------------------------------------- */

            gender: {
                type: String,
                trim: true,
                maxlength: 30,
                default: ''
            },

            dateOfBirth: {
                type: Date,
                default: null
            },

            mobile: {
                type: String,
                trim: true,
                maxlength: 10,
                default: ''
            },

            address: {
                type: String,
                trim: true,
                maxlength: 500,
                default: ''
            },

            state: {
                type: String,
                trim: true,
                maxlength: 100,
                default: ''
            },


            /* ----------------------------------------------------
               FINANCIAL / ACADEMIC INFORMATION
            ---------------------------------------------------- */

            familyIncome: {
                type: Number,
                default: null,
                min: 0,
                max: 1000000000
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
                maxlength: 100,
                default: ''
            },


            /* ----------------------------------------------------
               BANK INFORMATION
            ---------------------------------------------------- */

            bankAccountNumber: {
                type: String,
                trim: true,
                maxlength: 30,
                default: ''
            },

            bankName: {
                type: String,
                trim: true,
                maxlength: 150,
                default: ''
            },

            ifscCode: {
                type: String,
                trim: true,
                uppercase: true,
                maxlength: 11,
                default: ''
            },


            /* ----------------------------------------------------
               PROFILE STATUS
            ---------------------------------------------------- */

            profileCompleted: {
                type: Boolean,
                default: false
            }
        },

        {
            timestamps: true,
            strict: true
        }
    );


/* ============================================================
   DATABASE INDEXES
============================================================ */

/*
   user:
   unique: true ensures one profile per user.

   registrationNumber:
   unique: true prevents the same registration number
   from being assigned to multiple student profiles.

   Mongoose creates the required unique indexes.
*/


/* ============================================================
   MODEL
============================================================ */

const StudentProfile =
    mongoose.model(
        'StudentProfile',
        studentProfileSchema
    );


module.exports = StudentProfile;