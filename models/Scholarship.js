const mongoose = require('mongoose');


/* ============================================================
   SCHOLARSHIP SCHEMA
============================================================ */

const scholarshipSchema =
    new mongoose.Schema(
        {

            /* ====================================================
               BASIC SCHOLARSHIP INFORMATION
            ==================================================== */

            name: {
                type: String,
                required: true,
                trim: true,
                minlength: 2,
                maxlength: 200
            },

            description: {
                type: String,
                required: true,
                trim: true,
                maxlength: 5000
            },

            academicYear: {
                type: String,
                required: true,
                trim: true,
                maxlength: 20
            },


            /* ====================================================
               ELIGIBILITY
            ==================================================== */

            eligibleCourses: {
                type: [
                    {
                        type: String,
                        trim: true,
                        maxlength: 100
                    }
                ],
                default: []
            },

            eligibleDepartments: {
                type: [
                    {
                        type: String,
                        trim: true,
                        maxlength: 100
                    }
                ],
                default: []
            },

            eligibleCategories: {
                type: [
                    {
                        type: String,
                        trim: true,
                        maxlength: 50
                    }
                ],
                default: []
            },

            minimumPercentage: {
                type: Number,
                default: 0,
                min: 0,
                max: 100
            },

            maximumFamilyIncome: {
                type: Number,
                default: null,
                min: 0,
                max: 1000000000
            },


            /* ====================================================
               SCHOLARSHIP AMOUNT
            ==================================================== */

            scholarshipAmount: {
                type: Number,
                required: true,
                min: 0,
                max: 1000000000
            },


            /* ====================================================
               REQUIRED DOCUMENTS
            ==================================================== */

            requiredDocuments: {
                type: [
                    {
                        type: String,
                        trim: true,
                        maxlength: 150
                    }
                ],
                default: []
            },


            /* ====================================================
               APPLICATION PERIOD
            ==================================================== */

            applicationStartDate: {
                type: Date,
                required: true
            },

            applicationEndDate: {
                type: Date,
                required: true
            },


            /* ====================================================
               INSTRUCTIONS
            ==================================================== */

            instructions: {
                type: String,
                trim: true,
                maxlength: 5000,
                default: ''
            },


            /* ====================================================
               STATUS
            ==================================================== */

            status: {
                type: String,

                enum: [
                    'DRAFT',
                    'PUBLISHED',
                    'CLOSED'
                ],

                default: 'DRAFT'
            },


            /* ====================================================
               CREATED BY ADMIN
            ==================================================== */

            createdBy: {
                type:
                    mongoose.Schema.Types.ObjectId,

                ref: 'User',

                required: true,

                index: true
            }
        },

        {
            timestamps: true,
            strict: true
        }
    );


/* ============================================================
   ARRAY FIELD VALIDATION
============================================================ */

/*
   Prevent excessively large eligibility/document arrays.
*/

scholarshipSchema.path(
    'eligibleCourses'
).validate(
    function (value) {
        return (
            Array.isArray(value) &&
            value.length <= 100
        );
    },
    'Too many eligible courses.'
);


scholarshipSchema.path(
    'eligibleDepartments'
).validate(
    function (value) {
        return (
            Array.isArray(value) &&
            value.length <= 100
        );
    },
    'Too many eligible departments.'
);


scholarshipSchema.path(
    'eligibleCategories'
).validate(
    function (value) {
        return (
            Array.isArray(value) &&
            value.length <= 50
        );
    },
    'Too many eligible categories.'
);


scholarshipSchema.path(
    'requiredDocuments'
).validate(
    function (value) {
        return (
            Array.isArray(value) &&
            value.length <= 100
        );
    },
    'Too many required documents.'
);


/* ============================================================
   DATE VALIDATION
============================================================ */

/*
   Application end date cannot be earlier than
   the application start date.
*/

scholarshipSchema.pre(
    'validate',
    function (next) {

        if (
            this.applicationStartDate &&
            this.applicationEndDate &&
            this.applicationEndDate <
                this.applicationStartDate
        ) {
            return next(
                new Error(
                    'Application end date cannot be earlier than application start date.'
                )
            );
        }

        next();
    }
);


/* ============================================================
   DATABASE INDEXES
============================================================ */

scholarshipSchema.index({
    status: 1
});


scholarshipSchema.index({
    academicYear: 1
});


scholarshipSchema.index({
    applicationStartDate: 1,
    applicationEndDate: 1
});


/* ============================================================
   MODEL
============================================================ */

const Scholarship =
    mongoose.model(
        'Scholarship',
        scholarshipSchema
    );


module.exports = Scholarship;