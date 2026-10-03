const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema(
    {
        /* ========================================================
           BASIC SCHOLARSHIP INFORMATION
        ======================================================== */

        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        academicYear: {
            type: String,
            required: true,
            trim: true
        },

        /* ========================================================
           ELIGIBILITY
        ======================================================== */

        eligibleCourses: {
            type: [String],
            default: []
        },

        eligibleDepartments: {
            type: [String],
            default: []
        },

        eligibleCategories: {
            type: [String],
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
            default: null
        },

        /* ========================================================
           SCHOLARSHIP AMOUNT
        ======================================================== */

        scholarshipAmount: {
            type: Number,
            required: true,
            min: 0
        },

        /* ========================================================
           REQUIRED DOCUMENTS
        ======================================================== */

        requiredDocuments: {
            type: [String],
            default: []
        },

        /* ========================================================
           APPLICATION PERIOD
        ======================================================== */

        applicationStartDate: {
            type: Date,
            required: true
        },

        applicationEndDate: {
            type: Date,
            required: true
        },

        /* ========================================================
           INSTRUCTIONS
        ======================================================== */

        instructions: {
            type: String,
            default: '',
            trim: true
        },

        /* ========================================================
           STATUS
        ======================================================== */

        status: {
            type: String,
            enum: ['DRAFT', 'PUBLISHED', 'CLOSED'],
            default: 'DRAFT'
        },

        /* ========================================================
           CREATED BY ADMIN
        ======================================================== */

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    {
        timestamps: true
    }
);

/* ============================================================
   INDEXES
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

const Scholarship = mongoose.model(
    'Scholarship',
    scholarshipSchema
);

module.exports = Scholarship;