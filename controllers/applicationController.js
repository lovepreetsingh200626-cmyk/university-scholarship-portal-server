const mongoose =
    require('mongoose');

const ScholarshipApplication =
    require('../models/ScholarshipApplication');

const Scholarship =
    require('../models/Scholarship');

const StudentProfile =
    require('../models/StudentProfile');

const {
    checkStudentEligibility
} = require('../services/eligibilityService');

const cloudinary =
    require('../config/cloudinary');

const crypto =
    require('crypto');

const path =
    require('path');

const { Readable } =
    require('stream');


/* ============================================================
   VALIDATE MONGODB OBJECT ID
============================================================ */

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};


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
   VALIDATE FILE SIGNATURE
============================================================ */

const validateFileSignature = (
    buffer,
    contentType
) => {
    if (
        !buffer ||
        !Buffer.isBuffer(buffer) ||
        buffer.length === 0
    ) {
        return false;
    }

    /*
       PDF
       Starts with:
       %PDF-
    */

    if (
        contentType ===
        'application/pdf'
    ) {
        const pdfSignature =
            Buffer.from('%PDF-');

        return buffer
            .subarray(
                0,
                pdfSignature.length
            )
            .equals(pdfSignature);
    }

    /*
       JPEG
       Starts with:
       FF D8 FF
    */

    if (
        contentType ===
        'image/jpeg'
    ) {
        return (
            buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff
        );
    }

    /*
       PNG
       Starts with:
       89 50 4E 47 0D 0A 1A 0A
    */

    if (
        contentType ===
        'image/png'
    ) {
        const pngSignature =
            Buffer.from([
                0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a
            ]);

        return buffer
            .subarray(
                0,
                pngSignature.length
            )
            .equals(pngSignature);
    }

    return false;
};


/* ============================================================
   CREATE APPLICATION DRAFT
============================================================ */

const createApplication = async (
    req,
    res
) => {
    try {
        const {
            scholarshipId
        } = req.body || {};

        /* --------------------------------------------------------
           VALIDATE SCHOLARSHIP ID
        -------------------------------------------------------- */

        if (!scholarshipId) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship ID is required.'
            });
        }

        if (
            typeof scholarshipId !==
                'string' ||
            !isValidObjectId(
                scholarshipId
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship ID.'
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
            scholarship.status !==
            'PUBLISHED'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'This scholarship is not currently available for applications.'
            });
        }

        const currentDate =
            new Date();

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
                application:
                    existingApplication
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
                    eligibility.failedCriteria ||
                    []
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

                status:
                    'DRAFT',

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

const getMyApplications = async (
    req,
    res
) => {
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
            count:
                applications.length,
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

const getApplicationById = async (
    req,
    res
) => {
    try {
        /* --------------------------------------------------------
           VALIDATE APPLICATION ID
        -------------------------------------------------------- */

        if (
            !isValidObjectId(
                req.params.id
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application ID.'
            });
        }

        /*
           Ownership is enforced directly
           in the MongoDB query.
        */

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
   SECURE APPLICATION DOCUMENT VIEW
============================================================ */

const getApplicationDocumentUrl = async (
    req,
    res
) => {
    try {
        /* --------------------------------------------------------
           VALIDATE APPLICATION ID
        -------------------------------------------------------- */

        if (
            !isValidObjectId(
                req.params.id
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application ID.'
            });
        }

        /* --------------------------------------------------------
           VALIDATE DOCUMENT ID
        -------------------------------------------------------- */

        if (
            !isValidObjectId(
                req.params.documentId
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid document ID.'
            });
        }

        const application =
            await ScholarshipApplication.findById(
                req.params.id
            );

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    'Application not found.'
            });
        }

        /*
           Students can access only their own
           application documents.

           Admins can access documents for
           verification purposes.
        */

        if (
            req.user.role !== 'admin' &&
            application.student.toString() !==
                req.user.id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'You are not authorized to access this application document.'
            });
        }

        const document =
            application.documents.find(
                (item) =>
                    item._id.toString() ===
                    req.params.documentId
            );

        if (!document) {
            return res.status(404).json({
                success: false,
                message:
                    'Document not found.'
            });
        }

        /*
           Old Vercel Blob documents do not have
           a Cloudinary public ID.
        */

        if (
            !document.cloudinaryPublicId
        ) {
            return res.status(410).json({
                success: false,
                message:
                    'This document is from an older storage system and is no longer available through the secure document service.'
            });
        }

        /*
           Validate stored content type.
        */

        const allowedContentTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png'
        ];

        if (
            !allowedContentTypes.includes(
                document.contentType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The document format is not supported.'
            });
        }

        /*
           Determine original file extension.
        */

        const originalExtension =
            path
                .extname(
                    document.fileName ||
                        ''
                )
                .toLowerCase()
                .replace(
                    '.',
                    ''
                );

        const allowedFormats = [
            'pdf',
            'jpg',
            'jpeg',
            'png'
        ];

        if (
            !allowedFormats.includes(
                originalExtension
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The document format is not supported.'
            });
        }

        /*
           Generate a short-lived authenticated
           Cloudinary URL.

           This URL is used ONLY by the backend.
           It is never returned to the browser.
        */

        const expiresAt =
            Math.floor(
                Date.now() / 1000
            ) + 300;

        const secureUrl =
            cloudinary.utils.private_download_url(
                document.cloudinaryPublicId,
                originalExtension,
                {
                    resource_type:
                        'raw',

                    type:
                        'authenticated',

                    expires_at:
                        expiresAt,

                    secure:
                        true
                }
            );

        /*
           Retrieve the private Cloudinary
           document from the backend.
        */

        const cloudinaryResponse =
            await fetch(
                secureUrl
            );

        if (
            !cloudinaryResponse.ok
        ) {
            console.error(
                'Cloudinary document retrieval failed:',
                cloudinaryResponse.status,
                cloudinaryResponse.statusText
            );

            return res.status(502).json({
                success: false,
                message:
                    'Unable to retrieve the document from secure storage.'
            });
        }

        if (
            !cloudinaryResponse.body
        ) {
            return res.status(502).json({
                success: false,
                message:
                    'The document storage service returned an empty response.'
            });
        }

        /*
           Prevent browser caching of private
           scholarship documents.
        */

        res.setHeader(
            'Cache-Control',
            'private, no-store, max-age=0'
        );

        res.setHeader(
            'X-Content-Type-Options',
            'nosniff'
        );

        /*
           Tell browser exactly what type
           of document it is.
        */

        res.setHeader(
            'Content-Type',
            document.contentType
        );

        /*
           Clean filename before using it
           in the response header.
        */

        const safeFileName =
            String(
                document.fileName ||
                    `document.${originalExtension}`
            )
                .replace(
                    /[\r\n"]/g,
                    '_'
                );

        res.setHeader(
            'Content-Disposition',
            `inline; filename="${safeFileName}"`
        );

        /*
           Forward content length when available.
        */

        const contentLength =
            cloudinaryResponse.headers.get(
                'content-length'
            );

        if (contentLength) {
            res.setHeader(
                'Content-Length',
                contentLength
            );
        }

        /*
           Stream Cloudinary response
           directly to browser.
        */

        Readable
            .fromWeb(
                cloudinaryResponse.body
            )
            .pipe(res);

    } catch (error) {
        console.error(
            'Get secure document error:',
            error
        );

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message:
                    'Unable to retrieve the scholarship document.'
            });
        }

        res.end();
    }
};


/* ============================================================
   UPDATE APPLICATION
============================================================ */

const updateApplication = async (
    req,
    res
) => {
    try {
        /* --------------------------------------------------------
           VALIDATE APPLICATION ID
        -------------------------------------------------------- */

        if (
            !isValidObjectId(
                req.params.id
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application ID.'
            });
        }

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application data.'
            });
        }

        /*
           Ownership is enforced directly
           in the MongoDB query.
        */

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
            ].includes(
                application.status
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'This application cannot be edited in its current status.'
            });
        }

        /*
           Only these applicant fields can
           be modified by the student.

           Sensitive ownership/status fields
           cannot be changed from the request.
        */

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

        allowedFields.forEach(
            (field) => {
                if (
                    req.body[field] !==
                    undefined
                ) {
                    application
                        .applicantDetails[
                            field
                        ] =
                        req.body[field];
                }
            }
        );

        /* --------------------------------------------------------
           CURRENT SEMESTER VALIDATION
        -------------------------------------------------------- */

        if (
            req.body.currentSemester !==
            undefined
        ) {
            const semester =
                Number(
                    req.body.currentSemester
                );

            if (
                !Number.isInteger(
                    semester
                ) ||
                semester < 1 ||
                semester > 20
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Current semester must be a valid number.'
                });
            }

            application
                .applicantDetails
                .currentSemester =
                semester;
        }

        /* --------------------------------------------------------
           FAMILY INCOME VALIDATION
        -------------------------------------------------------- */

        if (
            req.body.familyIncome !==
                undefined &&
            req.body.familyIncome !==
                null &&
            req.body.familyIncome !==
                ''
        ) {
            const income =
                Number(
                    req.body.familyIncome
                );

            if (
                !Number.isFinite(
                    income
                ) ||
                income < 0 ||
                income > 1000000000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Family income must be a valid non-negative number.'
                });
            }

            application
                .applicantDetails
                .familyIncome =
                income;
        }

        /* --------------------------------------------------------
           PREVIOUS PERCENTAGE VALIDATION
        -------------------------------------------------------- */

        if (
            req.body.previousPercentage !==
                undefined &&
            req.body.previousPercentage !==
                null &&
            req.body.previousPercentage !==
                ''
        ) {
            const percentage =
                Number(
                    req.body
                        .previousPercentage
                );

            if (
                !Number.isFinite(
                    percentage
                ) ||
                percentage < 0 ||
                percentage > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Previous percentage must be between 0 and 100.'
                });
            }

            application
                .applicantDetails
                .previousPercentage =
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
    let uploadedPublicId = null;
    let cleanupAlreadyCompleted = false;

    try {
        /* --------------------------------------------------------
           VALIDATE APPLICATION ID
        -------------------------------------------------------- */

        if (
            !isValidObjectId(
                req.params.id
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application ID.'
            });
        }

        const documentType =
            typeof req.body.documentType ===
            'string'
                ? req.body.documentType.trim()
                : '';

        if (!documentType) {
            return res.status(400).json({
                success: false,
                message:
                    'Document type is required.'
            });
        }

        /*
           Prevent excessively large document
           type values.
        */

        if (
            documentType.length > 150
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid document type.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message:
                    'Please select a document file.'
            });
        }

        if (
            !req.file.buffer ||
            !Buffer.isBuffer(
                req.file.buffer
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Uploaded file data is invalid.'
            });
        }

        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png'
        ];

        if (
            !allowedMimeTypes.includes(
                req.file.mimetype
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Only PDF, JPG and PNG files are allowed.'
            });
        }

        if (
            !validateFileSignature(
                req.file.buffer,
                req.file.mimetype
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The uploaded file content does not match its file type.'
            });
        }

        const application =
            await ScholarshipApplication.findOne({
                _id: req.params.id,
                student: req.user.id
            }).populate(
                'scholarship'
            );

        /*
           Ownership is enforced directly
           in the MongoDB query.
        */

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
            ].includes(
                application.status
            )
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

        const existingDocument =
            existingDocumentIndex !== -1
                ? application.documents[
                      existingDocumentIndex
                  ]
                : null;

        /*
           Validate extension.
        */

        const extension =
            path
                .extname(
                    req.file.originalname ||
                        ''
                )
                .toLowerCase();

        const allowedExtensions = [
            '.pdf',
            '.jpg',
            '.jpeg',
            '.png'
        ];

        if (
            !allowedExtensions.includes(
                extension
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid file extension.'
            });
        }

        /*
           Cloudinary raw authenticated
           storage.
        */

        const resourceType =
            'raw';

        const uniqueId =
            crypto.randomUUID();

        const publicId =
            `scholarships/${application._id}/${uniqueId}`;

        /*
           Upload the in-memory file buffer
           directly to Cloudinary.
        */

        const uploadResult =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {
                    const uploadStream =
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type:
                                    resourceType,

                                public_id:
                                    publicId,

                                type:
                                    'authenticated',

                                overwrite:
                                    false,

                                use_filename:
                                    false,

                                unique_filename:
                                    false
                            },
                            (
                                error,
                                result
                            ) => {
                                if (
                                    error
                                ) {
                                    return reject(
                                        error
                                    );
                                }

                                resolve(
                                    result
                                );
                            }
                        );

                    uploadStream.end(
                        req.file.buffer
                    );
                }
            );

        uploadedPublicId =
            uploadResult.public_id;

        /*
           Store Cloudinary metadata only.
           No public download URL is stored.
        */

        const documentData = {
            documentType:
                documentType,

            fileName:
                req.file.originalname,

            cloudinaryPublicId:
                uploadResult.public_id,

            contentType:
                req.file.mimetype,

            fileSize:
                req.file.size,

            uploadedAt:
                new Date()
        };

        /*
           Replace existing document
           or add new document.
        */

        if (
            existingDocumentIndex !==
            -1
        ) {
            application.documents[
                existingDocumentIndex
            ] = documentData;
        } else {
            application.documents.push(
                documentData
            );
        }

        try {
            await application.save();

        } catch (
            databaseError
        ) {
            /*
               MongoDB failed after Cloudinary
               upload.

               Delete newly uploaded file.
            */

            try {
                await cloudinary.uploader.destroy(
                    uploadedPublicId,
                    {
                        resource_type:
                            resourceType,

                        type:
                            'authenticated'
                    }
                );

                cleanupAlreadyCompleted =
                    true;

            } catch (
                cleanupError
            ) {
                console.error(
                    'Cloudinary cleanup error after database failure:',
                    cleanupError
                );
            }

            throw databaseError;
        }

        /*
           Delete old Cloudinary document only
           after MongoDB successfully saved.
        */

        if (
            existingDocument &&
            existingDocument.cloudinaryPublicId &&
            existingDocument.cloudinaryPublicId !==
                uploadResult.public_id
        ) {
            try {
                await cloudinary.uploader.destroy(
                    existingDocument.cloudinaryPublicId,
                    {
                        resource_type:
                            resourceType,

                        type:
                            'authenticated'
                    }
                );

            } catch (
                deleteOldDocumentError
            ) {
                console.error(
                    'Unable to delete previous Cloudinary document:',
                    deleteOldDocumentError
                );
            }
        }

        uploadedPublicId = null;

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

        /*
           Clean up newly uploaded Cloudinary
           object if operation failed.
        */

        if (
            uploadedPublicId &&
            !cleanupAlreadyCompleted
        ) {
            try {
                await cloudinary.uploader.destroy(
                    uploadedPublicId,
                    {
                        resource_type:
                            'raw',

                        type:
                            'authenticated'
                    }
                );

            } catch (
                cleanupError
            ) {
                console.error(
                    'Unexpected Cloudinary cleanup error:',
                    cleanupError
                );
            }
        }

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

const submitApplication = async (
    req,
    res
) => {
    try {
        /* --------------------------------------------------------
           VALIDATE APPLICATION ID
        -------------------------------------------------------- */

        if (
            !isValidObjectId(
                req.params.id
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application ID.'
            });
        }

        const application =
            await ScholarshipApplication.findOne({
                _id: req.params.id,
                student: req.user.id
            }).populate(
                'scholarship'
            );

        /*
           Ownership is enforced directly
           in the MongoDB query.
        */

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
            ].includes(
                application.status
            )
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

        const currentDate =
            new Date();

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
                        value ===
                            undefined ||
                        value === null ||
                        value === ''
                    );
                }
            );

        if (
            missingFields.length > 0
        ) {
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
                    eligibility.failedCriteria ||
                    []
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
    getApplicationDocumentUrl,
    updateApplication,
    uploadApplicationDocument,
    submitApplication
};