const ScholarshipApplication =
    require('../models/ScholarshipApplication');

const Scholarship =
    require('../models/Scholarship');

const StudentProfile =
    require('../models/StudentProfile');

const {
    checkStudentEligibility
} = require('../services/eligibilityService');

/* ============================================================
   GENERATE APPLICATION NUMBER
============================================================ */

const generateApplicationNumber = () => {
    const timestamp = Date.now();

    const randomNumber = Math.floor(
        1000 + Math.random() * 9000
    );

    return `SCH-${timestamp}-${randomNumber}`;
};

/* ============================================================
   CREATE APPLICATION DRAFT
============================================================ */

const createApplication = async (req, res) => {
    try {
        const {
            scholarshipId
        } = req.body;

        if (!scholarshipId) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship ID is required.'
            });
        }

        const scholarship =
            await Scholarship.findById(
                scholarshipId
            );

        if (!scholarship) {
            return res.status(404).json({
                success: false,
                message:
                    'Scholarship not found.'
            });
        }

        if (
            scholarship.status !== 'PUBLISHED'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'This scholarship is not currently available for applications.'
            });
        }

        const currentDate = new Date();

        if (
            currentDate <
            scholarship.applicationStartDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The scholarship application period has not started yet.'
            });
        }

        if (
            currentDate >
            scholarship.applicationEndDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The scholarship application deadline has passed.'
            });
        }

        const studentProfile =
            await StudentProfile.findOne({
                user: req.user.id
            });

        if (!studentProfile) {
            return res.status(400).json({
                success: false,
                message:
                    'Please complete your student profile before applying.'
            });
        }

        const existingApplication =
            await ScholarshipApplication.findOne({
                student: req.user.id,
                scholarship: scholarshipId
            });

        if (existingApplication) {
            return res.status(409).json({
                success: false,
                message:
                    'You already have an application for this scholarship.',
                application: existingApplication
            });
        }

        const eligibility =
            await checkStudentEligibility(
                req.user.id,
                scholarshipId
            );

        if (!eligibility.eligible) {
            return res.status(403).json({
                success: false,
                message:
                    'You are not eligible for this scholarship.',
                reason:
                    eligibility.reason,
                failedCriteria:
                    eligibility.failedCriteria || []
            });
        }

        const applicantDetails = {
            fullName:
                studentProfile.fullName,

            registrationNumber:
                studentProfile.registrationNumber,

            course:
                studentProfile.course,

            department:
                studentProfile.department,

            academicYear:
                studentProfile.academicYear,

            currentSemester:
                studentProfile.currentSemester,

            category:
                studentProfile.category,

            gender:
                studentProfile.gender,

            dateOfBirth:
                studentProfile.dateOfBirth,

            mobile:
                studentProfile.mobile,

            address:
                studentProfile.address,

            state:
                studentProfile.state,

            familyIncome:
                studentProfile.familyIncome,

            previousPercentage:
                studentProfile.previousPercentage,

            previousQualification:
                studentProfile.previousQualification,

            bankAccountNumber:
                studentProfile.bankAccountNumber,

            bankName:
                studentProfile.bankName,

            ifscCode:
                studentProfile.ifscCode
        };

        const application =
            await ScholarshipApplication.create({
                student: req.user.id,

                scholarship:
                    scholarshipId,

                applicationNumber:
                    generateApplicationNumber(),

                status: 'DRAFT',

                applicantDetails,

                documents: []
            });

        return res.status(201).json({
            success: true,
            message:
                'Scholarship application draft created successfully.',
            application
        });

    } catch (error) {
        console.error(
            'Create application error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to create scholarship application.'
        });
    }
};

/* ============================================================
   GET MY APPLICATIONS
============================================================ */

const getMyApplications = async (req, res) => {
    try {
        const applications =
            await ScholarshipApplication.find({
                student: req.user.id
            })
                .populate(
                    'scholarship',
                    'name academicYear scholarshipAmount applicationStartDate applicationEndDate status'
                )
                .sort({
                    createdAt: -1
                });

        return res.status(200).json({
            success: true,
            count: applications.length,
            applications
        });

    } catch (error) {
        console.error(
            'Get applications error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to fetch your scholarship applications.'
        });
    }
};

/* ============================================================
   GET APPLICATION BY ID
============================================================ */

const getApplicationById = async (req, res) => {
    try {
        const application =
            await ScholarshipApplication.findOne({
                _id: req.params.id,
                student: req.user.id
            })
                .populate(
                    'scholarship',
                    'name description academicYear eligibleCourses eligibleDepartments eligibleCategories minimumPercentage maximumFamilyIncome scholarshipAmount requiredDocuments applicationStartDate applicationEndDate instructions status'
                )
                .populate(
                    'student',
                    'name email mobile'
                );

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    'Application not found.'
            });
        }

        return res.status(200).json({
            success: true,
            application
        });

    } catch (error) {
        console.error(
            'Get application error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to fetch application.'
        });
    }
};

/* ============================================================
   UPDATE APPLICATION
============================================================ */

const updateApplication = async (req, res) => {
    try {
        const application =
            await ScholarshipApplication.findOne({
                _id: req.params.id,
                student: req.user.id
            });

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    'Application not found.'
            });
        }

        if (
            ![
                'DRAFT',
                'CORRECTION REQUIRED',
                'RESUBMITTED'
            ].includes(application.status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'This application cannot be edited in its current status.'
            });
        }

        const allowedFields = [
            'fullName',
            'registrationNumber',
            'course',
            'department',
            'academicYear',
            'currentSemester',
            'category',
            'gender',
            'dateOfBirth',
            'mobile',
            'address',
            'state',
            'familyIncome',
            'previousPercentage',
            'previousQualification',
            'bankAccountNumber',
            'bankName',
            'ifscCode'
        ];

        allowedFields.forEach((field) => {
            if (
                req.body[field] !== undefined
            ) {
                application.applicantDetails[field] =
                    req.body[field];
            }
        });

        if (
            req.body.currentSemester !== undefined
        ) {
            const semester = Number(
                req.body.currentSemester
            );

            if (
                !Number.isInteger(semester) ||
                semester < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Current semester must be a valid number.'
                });
            }

            application.applicantDetails.currentSemester =
                semester;
        }

        if (
            req.body.familyIncome !== undefined &&
            req.body.familyIncome !== null &&
            req.body.familyIncome !== ''
        ) {
            const income = Number(
                req.body.familyIncome
            );

            if (
                Number.isNaN(income) ||
                income < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Family income must be a valid non-negative number.'
                });
            }

            application.applicantDetails.familyIncome =
                income;
        }

        if (
            req.body.previousPercentage !== undefined &&
            req.body.previousPercentage !== null &&
            req.body.previousPercentage !== ''
        ) {
            const percentage = Number(
                req.body.previousPercentage
            );

            if (
                Number.isNaN(percentage) ||
                percentage < 0 ||
                percentage > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Previous percentage must be between 0 and 100.'
                });
            }

            application.applicantDetails.previousPercentage =
                percentage;
        }

        await application.save();

        return res.status(200).json({
            success: true,
            message:
                'Application updated successfully.',
            application
        });

    } catch (error) {
        console.error(
            'Update application error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to update application.'
        });
    }
};

/* ============================================================
   UPLOAD APPLICATION DOCUMENT
============================================================ */

const uploadApplicationDocument = async (
    req,
    res
) => {
    try {
        const {
            documentType
        } = req.body;

        if (!documentType) {
            return res.status(400).json({
                success: false,
                message:
                    'Document type is required.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message:
                    'Please select a document file.'
            });
        }

        const application =
            await ScholarshipApplication.findOne({
                _id: req.params.id,
                student: req.user.id
            }).populate(
                'scholarship'
            );

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    'Application not found.'
            });
        }

        if (
            ![
                'DRAFT',
                'CORRECTION REQUIRED',
                'RESUBMITTED'
            ].includes(application.status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Documents cannot be uploaded in the current application status.'
            });
        }

        const scholarship =
            application.scholarship;

        const requiredDocuments =
            scholarship &&
            Array.isArray(
                scholarship.requiredDocuments
            )
                ? scholarship.requiredDocuments
                : [];

        if (
            !requiredDocuments.includes(
                documentType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'This document type is not required for this scholarship.'
            });
        }

        const existingDocumentIndex =
            application.documents.findIndex(
                (document) =>
                    document.documentType ===
                    documentType
            );

        const documentData = {
            documentType:
                documentType.trim(),

            fileName:
                req.file.originalname,

            fileUrl:
                `/uploads/scholarships/${req.file.filename}`,

            uploadedAt:
                new Date()
        };

        if (
            existingDocumentIndex !== -1
        ) {
            application.documents[
                existingDocumentIndex
            ] = documentData;
        } else {
            application.documents.push(
                documentData
            );
        }

        await application.save();

        return res.status(200).json({
            success: true,
            message:
                'Document uploaded successfully.',
            document:
                documentData,
            applicationId:
                application._id
        });

    } catch (error) {
        console.error(
            'Document upload error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to upload document.'
        });
    }
};

/* ============================================================
   SUBMIT APPLICATION
============================================================ */

const submitApplication = async (req, res) => {
    try {
        const application =
            await ScholarshipApplication.findOne({
                _id: req.params.id,
                student: req.user.id
            }).populate(
                'scholarship'
            );

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    'Application not found.'
            });
        }

        if (
            ![
                'DRAFT',
                'CORRECTION REQUIRED',
                'RESUBMITTED'
            ].includes(application.status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'This application cannot be submitted in its current status.'
            });
        }

        const scholarship =
            application.scholarship;

        if (!scholarship) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship information is unavailable.'
            });
        }

        const currentDate = new Date();

        if (
            currentDate <
            scholarship.applicationStartDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The scholarship application period has not started yet.'
            });
        }

        if (
            currentDate >
            scholarship.applicationEndDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The scholarship application deadline has passed.'
            });
        }

        const details =
            application.applicantDetails;

        const requiredFields = [
            'fullName',
            'registrationNumber',
            'course',
            'department',
            'academicYear',
            'currentSemester',
            'category'
        ];

        const missingFields =
            requiredFields.filter(
                (field) => {
                    const value =
                        details[field];

                    return (
                        value === undefined ||
                        value === null ||
                        value === ''
                    );
                }
            );

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    'Please complete all required application details before submitting.',
                missingFields
            });
        }

        const eligibility =
            await checkStudentEligibility(
                req.user.id,
                scholarship._id
            );

        if (!eligibility.eligible) {
            return res.status(403).json({
                success: false,
                message:
                    'You are not eligible to submit this scholarship application.',
                reason:
                    eligibility.reason,
                failedCriteria:
                    eligibility.failedCriteria || []
            });
        }

        const requiredDocuments =
            Array.isArray(
                scholarship.requiredDocuments
            )
                ? scholarship.requiredDocuments
                : [];

        const uploadedDocuments =
            Array.isArray(
                application.documents
            )
                ? application.documents
                : [];

        const uploadedDocumentTypes =
            uploadedDocuments.map(
                (document) =>
                    document.documentType
            );

        const missingDocuments =
            requiredDocuments.filter(
                (requiredDocument) =>
                    !uploadedDocumentTypes.includes(
                        requiredDocument
                    )
            );

        if (
            missingDocuments.length > 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please upload all required documents before submitting the application.',
                missingDocuments
            });
        }

        application.status =
            application.status ===
            'CORRECTION REQUIRED'
                ? 'RESUBMITTED'
                : 'SUBMITTED';

        application.submittedAt =
            new Date();

        application.correctionRemarks =
            '';

        await application.save();

        return res.status(200).json({
            success: true,
            message:
                application.status ===
                'RESUBMITTED'
                    ? 'Application resubmitted successfully.'
                    : 'Application submitted successfully.',
            application
        });

    } catch (error) {
        console.error(
            'Submit application error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to submit scholarship application.'
        });
    }
};

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    createApplication,
    getMyApplications,
    getApplicationById,
    updateApplication,
    uploadApplicationDocument,
    submitApplication
};