const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
    {
        course: { type: String, trim: true, maxlength: 120, default: '' },
        branch: { type: String, trim: true, maxlength: 120, default: '' },
        year: { type: String, trim: true, maxlength: 40, default: '' },
        faculty: { type: String, trim: true, maxlength: 120, default: '' },
        facultyId: { type: String, trim: true, maxlength: 30, default: '' },
        academicSession: { type: String, trim: true, maxlength: 20, default: '' }
    },
    { _id: false }
);

const freeshipCardApplicationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true
        },
        applicationNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 50
        },
        status: {
            type: String,
            enum: ['DRAFT', 'PENDING APPROVAL', 'APPROVED', 'REJECTED'],
            default: 'DRAFT',
            index: true
        },
        personalDetails: {
            fullName: { type: String, trim: true, maxlength: 100, default: '' },
            aadhaarEncrypted: { type: String, select: false, default: '' },
            aadhaarLastFour: { type: String, trim: true, maxlength: 4, default: '' },
            dateOfBirth: { type: Date, default: null },
            fatherName: { type: String, trim: true, maxlength: 100, default: '' },
            motherName: { type: String, trim: true, maxlength: 100, default: '' },
            annualFamilyIncome: { type: Number, min: 0, max: 1000000000, default: null },
            category: { type: String, trim: true, maxlength: 60, default: '' },
            applicantId: { type: String, trim: true, maxlength: 50, default: '' },
            mobile: { type: String, trim: true, maxlength: 20, default: '' },
            email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
            village: { type: String, trim: true, maxlength: 120, default: '' },
            postOffice: { type: String, trim: true, maxlength: 120, default: '' },
            tehsil: { type: String, trim: true, maxlength: 120, default: '' },
            district: { type: String, trim: true, maxlength: 120, default: '' },
            state: { type: String, trim: true, maxlength: 100, default: '' },
            domicileState: { type: String, trim: true, maxlength: 100, default: '' },
            pinCode: { type: String, trim: true, maxlength: 10, default: '' }
        },
        courseDetails: {
            presentlyStudying: { type: courseSchema, default: () => ({}) },
            lastClassStudied: { type: courseSchema, default: () => ({}) },
            previousClassStudied: { type: courseSchema, default: () => ({}) }
        },
        declarations: {
            hasReadGuidelines: { type: Boolean, default: null },
            informationAccurate: { type: Boolean, default: null },
            undertakeReimbursement: { type: Boolean, default: null }
        },
        documents: [
            {
                documentType: {
                    type: String,
                    enum: ['photo', 'incomeCertificate', 'casteCertificate', 'passingCertificate'],
                    required: true
                },
                fileName: { type: String, required: true, trim: true, maxlength: 200 },
                cloudinaryPublicId: { type: String, required: true, trim: true, maxlength: 500 },
                contentType: {
                    type: String,
                    required: true,
                    enum: ['application/pdf', 'image/jpeg', 'image/png']
                },
                fileSize: { type: Number, required: true, min: 1, max: 125 * 1024 },
                uploadedAt: { type: Date, default: Date.now }
            }
        ],
        reviewRemarks: { type: String, trim: true, maxlength: 2000, default: '' },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        submittedAt: { type: Date, default: null },
        reviewedAt: { type: Date, default: null }
    },
    { timestamps: true, strict: true }
);

module.exports = mongoose.model(
    'FreeshipCardApplication',
    freeshipCardApplicationSchema
);
