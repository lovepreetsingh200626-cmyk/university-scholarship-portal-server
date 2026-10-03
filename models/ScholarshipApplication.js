const mongoose = require('mongoose');

const scholarshipApplicationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        scholarship: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Scholarship',
            required: true
        },

        applicationNumber: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        status: {
            type: String,
            enum: [
                'DRAFT',
                'SUBMITTED',
                'UNDER VERIFICATION',
                'CORRECTION REQUIRED',
                'RESUBMITTED',
                'VERIFIED',
                'SANCTIONED',
                'DISBURSED',
                'REJECTED'
            ],
            default: 'DRAFT'
        },

        applicantDetails: {
            fullName: {
                type: String,
                trim: true,
                default: ''
            },

            registrationNumber: {
                type: String,
                trim: true,
                default: ''
            },

            course: {
                type: String,
                trim: true,
                default: ''
            },

            department: {
                type: String,
                trim: true,
                default: ''
            },

            academicYear: {
                type: String,
                trim: true,
                default: ''
            },

            currentSemester: {
                type: Number,
                default: null
            },

            category: {
                type: String,
                trim: true,
                default: ''
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
                default: null
            },

            previousPercentage: {
                type: Number,
                default: null
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
            }
        },

        documents: [
            {
                documentType: {
                    type: String,
                    required: true,
                    trim: true
                },

                fileName: {
                    type: String,
                    required: true,
                    trim: true
                },

                fileUrl: {
                    type: String,
                    required: true,
                    trim: true
                },

                uploadedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        correctionRemarks: {
            type: String,
            trim: true,
            default: ''
        },

        verificationRemarks: {
            type: String,
            trim: true,
            default: ''
        },

        rejectionReason: {
            type: String,
            trim: true,
            default: ''
        },

        submittedAt: {
            type: Date,
            default: null
        },

        verifiedAt: {
            type: Date,
            default: null
        },

        sanctionedAt: {
            type: Date,
            default: null
        },

        disbursedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

/* ============================================================
   INDEXES
============================================================ */

scholarshipApplicationSchema.index({
    student: 1,
    scholarship: 1
});

scholarshipApplicationSchema.index({
    status: 1
});

/*
   applicationNumber already has:
   unique: true
   sparse: true

   Therefore, no separate index is required here.
*/

/* ============================================================
   MODEL
============================================================ */

const ScholarshipApplication =
    mongoose.model(
        'ScholarshipApplication',
        scholarshipApplicationSchema
    );

module.exports = ScholarshipApplication;