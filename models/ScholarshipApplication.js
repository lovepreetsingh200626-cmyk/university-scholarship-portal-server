const mongoose = require('mongoose');


/* ============================================================
   SCHOLARSHIP APPLICATION SCHEMA
============================================================ */

const scholarshipApplicationSchema =
    new mongoose.Schema(
        {

            /* ----------------------------------------------------
               STUDENT
            ---------------------------------------------------- */

            student: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
                index: true
            },


            /* ----------------------------------------------------
               SCHOLARSHIP
            ---------------------------------------------------- */

            scholarship: {
                type:
                    mongoose.Schema.Types.ObjectId,
                ref: 'Scholarship',
                required: true,
                index: true
            },


            /* ----------------------------------------------------
               APPLICATION NUMBER
            ---------------------------------------------------- */

            applicationNumber: {
                type: String,
                unique: true,
                sparse: true,
                trim: true,
                maxlength: 50
            },


            /* ----------------------------------------------------
               APPLICATION STATUS
            ---------------------------------------------------- */

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

                /*
                   Do NOT use index: true here.

                   A separate schema.index({
                       status: 1
                   })
                   is defined below.
                */
            },


            /* ====================================================
               APPLICANT DETAILS
            ==================================================== */

            applicantDetails: {

                fullName: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

                studentId: {
                    type: String,
                    trim: true,
                    maxlength: 50,
                    default: ''
                },

                applicationType: {
                    type: String,
                    trim: true,
                    maxlength: 50,
                    default: ''
                },

                registrationNumber: {
                    type: String,
                    trim: true,
                    maxlength: 50,
                    default: ''
                },

                course: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

                department: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

                academicYear: {
                    type: String,
                    trim: true,
                    maxlength: 20,
                    default: ''
                },

                currentSemester: {
                    type: Number,
                    min: 1,
                    max: 20,
                    default: null
                },

                category: {
                    type: String,
                    trim: true,
                    maxlength: 50,
                    default: ''
                },

                fatherName: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

                motherName: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

                religion: {
                    type: String,
                    trim: true,
                    maxlength: 80,
                    default: ''
                },

                specialCategory: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

                aadhaarNumber: {
                    type: String,
                    trim: true,
                    maxlength: 20,
                    default: ''
                },

                deNotifiedTribes: {
                    type: String,
                    trim: true,
                    maxlength: 20,
                    default: ''
                },

                tribes: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

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

                institute: {
                    type: String,
                    trim: true,
                    maxlength: 200,
                    default: ''
                },

                tehsil: {
                    type: String,
                    trim: true,
                    maxlength: 120,
                    default: ''
                },

                hosteller: {
                    type: String,
                    trim: true,
                    maxlength: 20,
                    default: ''
                },

                class10Board: {
                    type: String,
                    trim: true,
                    maxlength: 200,
                    default: ''
                },

                class10Session: {
                    type: String,
                    trim: true,
                    maxlength: 30,
                    default: ''
                },

                class10RollNumber: {
                    type: String,
                    trim: true,
                    maxlength: 50,
                    default: ''
                },

                enrollment: {
                    type: String,
                    trim: true,
                    maxlength: 50,
                    default: ''
                },

                admissionDate: {
                    type: Date,
                    default: null
                },

                attendance: {
                    type: Number,
                    min: 0,
                    max: 100,
                    default: null
                },

                admitCard: {
                    type: String,
                    trim: true,
                    maxlength: 50,
                    default: ''
                },

                examinationYear: {
                    type: String,
                    trim: true,
                    maxlength: 30,
                    default: ''
                },

                promoted: {
                    type: String,
                    trim: true,
                    maxlength: 20,
                    default: ''
                },

                mobile: {
                    type: String,
                    trim: true,
                    maxlength: 10,
                    default: ''
                },

                emailAddress: {
                    type: String,
                    trim: true,
                    lowercase: true,
                    maxlength: 254,
                    default: ''
                },

                contactNumbers: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

                address: {
                    type: String,
                    trim: true,
                    maxlength: 500,
                    default: ''
                },

                correspondenceAddress: {
                    type: String,
                    trim: true,
                    maxlength: 500,
                    default: ''
                },

                permanentAddress: {
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

                familyIncome: {
                    type: Number,
                    min: 0,
                    max: 1000000000,
                    default: null
                },

                previousPercentage: {
                    type: Number,
                    min: 0,
                    max: 100,
                    default: null
                },

                previousQualification: {
                    type: String,
                    trim: true,
                    maxlength: 100,
                    default: ''
                },

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

                bankAddress: {
                    type: String,
                    trim: true,
                    maxlength: 300,
                    default: ''
                },

                bankBranchName: {
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

                declarationAccepted: {
                    type: Boolean,
                    default: false
                }
            },

            // Keep the full UID encrypted; it is only needed for the printed form.
            aadhaarEncrypted: {
                type: String,
                select: false,
                default: ''
            },


            /* ====================================================
               PRIVATE SCHOLARSHIP DOCUMENTS
            ==================================================== */

            documents: [

                {

                    documentType: {
                        type: String,
                        required: true,
                        trim: true,
                        maxlength: 150
                    },


                    /* ------------------------------------------------
                       ORIGINAL FILE NAME

                       Metadata only.

                       Never used as a storage identifier.
                    ------------------------------------------------ */

                    fileName: {
                        type: String,
                        required: true,
                        trim: true,
                        maxlength: 255
                    },


                    /* ------------------------------------------------
                       CLOUDINARY PRIVATE PUBLIC ID

                       This identifies the private Cloudinary asset.

                       It is NOT a public URL.
                    ------------------------------------------------ */

                    cloudinaryPublicId: {
                        type: String,
                        required: true,
                        trim: true,
                        maxlength: 500
                    },


                    /* ------------------------------------------------
                       VALIDATED CONTENT TYPE
                    ------------------------------------------------ */

                    contentType: {
                        type: String,
                        required: true,
                        enum: [
                            'application/pdf',
                            'image/jpeg',
                            'image/png'
                        ],
                        trim: true
                    },


                    /* ------------------------------------------------
                       FILE SIZE
                    ------------------------------------------------ */

                    fileSize: {
                        type: Number,
                        required: true,
                        min: 1,
                        max:
                            5 * 1024 * 1024
                    },


                    uploadedAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ],


            /* ====================================================
               VERIFICATION / CORRECTION INFORMATION
            ==================================================== */

            correctionRemarks: {
                type: String,
                trim: true,
                maxlength: 2000,
                default: ''
            },

            verificationRemarks: {
                type: String,
                trim: true,
                maxlength: 2000,
                default: ''
            },

            rejectionReason: {
                type: String,
                trim: true,
                maxlength: 2000,
                default: ''
            },


            /* ====================================================
               APPLICATION TIMESTAMPS
            ==================================================== */

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
            timestamps: true,
            strict: true
        }
    );


/* ============================================================
   INDEXES
============================================================ */

/*
   Helps retrieve applications belonging to a
   particular student for a particular scholarship.
*/

scholarshipApplicationSchema.index({
    student: 1,
    scholarship: 1
});


/*
   Helps administrators filter applications
   by their current workflow status.

   This is the ONLY index definition for status.
*/

scholarshipApplicationSchema.index({
    status: 1
});


/*
   applicationNumber already has:

       unique: true
       sparse: true

   Therefore, no additional index is required.
*/


/* ============================================================
   MODEL
============================================================ */

const ScholarshipApplication =
    mongoose.model(
        'ScholarshipApplication',
        scholarshipApplicationSchema
    );


module.exports =
    ScholarshipApplication;
