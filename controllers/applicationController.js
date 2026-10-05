const mongoose =
    require('mongoose');

const ScholarshipApplication =
    require('../models/ScholarshipApplication');

const Scholarship =
    require('../models/Scholarship');

const FreeshipCardApplication =
    require('../models/FreeshipCardApplication');

const User =
    require('../models/user');

const {
    checkStudentEligibility
} = require('../services/eligibilityService');

const cloudinary =
    require('../config/cloudinary');

const {
    addDocumentTitle,
    addFooter,
    addFullRow,
    addHeader,
    addMetadataStrip,
    addPairRow,
    addSection,
    createFormPdf,
    line: pdfLine,
    rect: pdfRect,
    text: pdfText
} = require('../utils/pdfFormLayout');

const { encryptAadhaar, decryptAadhaar } =
    require('../utils/aadhaarCrypto');

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

    return (
        typeof id === 'string' &&
        mongoose.isValidObjectId(id)
    );

};


/* ============================================================
   GENERATE APPLICATION NUMBER
============================================================ */

const generateApplicationNumber = () => {

    const timestamp =
        Date.now();

    const randomNumber =
        Math.floor(
            1000 +
            Math.random() * 9000
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


    /* --------------------------------------------------------
       PDF
       Starts with:
       %PDF-
    -------------------------------------------------------- */

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
            .equals(
                pdfSignature
            );

    }


    /* --------------------------------------------------------
       JPEG
       Starts with:
       FF D8 FF
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       PNG
       Starts with:
       89 50 4E 47 0D 0A 1A 0A
    -------------------------------------------------------- */

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
            .equals(
                pngSignature
            );

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

        if (
            !scholarshipId
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Scholarship ID is required.'
            });

        }


        if (
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


        if (
            !scholarship
        ) {

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


        const freeshipCard = await FreeshipCardApplication.findOne({
            student: req.user.id,
            status: 'APPROVED'
        })
            .select('+personalDetails.aadhaarEncrypted')
            .lean();

        if (!freeshipCard) {
            return res.status(403).json({
                success: false,
                code: 'FREESHIP_APPROVAL_REQUIRED',
                message: 'Your Freeship Card must be approved before you can apply for a scholarship.'
            });
        }

        const student = await User.findById(req.user.id)
            .select('name studentId email mobile')
            .lean();


        /* --------------------------------------------------------
           PREVENT DUPLICATE APPLICATION
        -------------------------------------------------------- */

        const existingApplication =
            await ScholarshipApplication.findOne({
                student:
                    req.user.id,

                scholarship:
                    scholarshipId
            });


        if (
            existingApplication
        ) {

            return res.status(409).json({
                success: false,
                message:
                    'You already have an application for this scholarship.',
                application:
                    existingApplication
            });

        }


        /* --------------------------------------------------------
           START THE FORM FROM THE APPROVED FREESHIP APPLICATION
        -------------------------------------------------------- */

        const personal = freeshipCard.personalDetails || {};
        const fullAadhaar = decryptAadhaar(personal.aadhaarEncrypted);
        const presentCourse = freeshipCard.courseDetails?.presentlyStudying || {};
        const address = [
            personal.village,
            personal.postOffice,
            personal.tehsil,
            personal.district,
            personal.state,
            personal.pinCode
        ].filter(Boolean).join(', ');
        const applicantDetails = {
            fullName: personal.fullName || student?.name || '',
            studentId: student?.studentId || personal.applicantId || '',
            registrationNumber: student?.studentId || '',
            applicationType: 'Fresh Application',
            course: presentCourse.course || '',
            department: presentCourse.branch || '',
            academicYear: '',
            category: personal.category || '',
            fatherName: personal.fatherName || '',
            motherName: personal.motherName || '',
            dateOfBirth: personal.dateOfBirth || null,
            familyIncome: personal.annualFamilyIncome ?? null,
            aadhaarNumber: personal.aadhaarLastFour ? `XXXXXXXX${personal.aadhaarLastFour}` : '',
            specialCategory: 'NA',
            deNotifiedTribes: 'No',
            tribes: 'NA',
            tehsil: personal.tehsil || '',
            mobile: student?.mobile || personal.mobile || '',
            contactNumbers: student?.mobile || personal.mobile || '',
            emailAddress: student?.email || personal.email || '',
            address,
            correspondenceAddress: address,
            permanentAddress: address,
            state: personal.state || '',
            previousQualification: freeshipCard.courseDetails?.lastClassStudied?.course || '',
            declarationAccepted: false
        };


        /* --------------------------------------------------------
           CREATE DRAFT
        -------------------------------------------------------- */

        const application =
            await ScholarshipApplication.create({

                student:
                    req.user.id,

                scholarship:
                    scholarshipId,

                applicationNumber:
                    generateApplicationNumber(),

                status:
                    'DRAFT',

                applicantDetails,

                aadhaarEncrypted: fullAadhaar ? encryptAadhaar(fullAadhaar) : '',

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


        if (
            error.code === 11000
        ) {

            return res.status(409).json({
                success: false,
                message:
                    'You already have an application for this scholarship.'
            });

        }


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

                student:
                    req.user.id

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

                _id:
                    req.params.id,

                student:
                    req.user.id

            })
                .select('+aadhaarEncrypted')
                .populate(
                    'scholarship',
                    'name description academicYear eligibleCourses eligibleDepartments eligibleCategories minimumPercentage maximumFamilyIncome scholarshipAmount requiredDocuments applicationStartDate applicationEndDate instructions status'
                )
                .populate(
                    'student',
                    'name email mobile'
                );


        if (
            !application
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Application not found.'

            });

        }

        const applicationResponse = application.toObject();
        const fullAadhaar = decryptAadhaar(application.aadhaarEncrypted);
        delete applicationResponse.aadhaarEncrypted;
        if (fullAadhaar) {
            applicationResponse.applicantDetails.aadhaarNumber = fullAadhaar;
        }

        return res.status(200).json({

            success: true,

            application: applicationResponse

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


        if (
            !application
        ) {

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


        if (
            !document
        ) {

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


        if (
            contentLength
        ) {

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
            .pipe(
                res
            );

    } catch (error) {

        console.error(
            'Get secure document error:',
            error
        );


        if (
            !res.headersSent
        ) {

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

                _id:
                    req.params.id,

                student:
                    req.user.id

            });


        if (
            !application
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Application not found.'

            });

        }


        /*
           Students can edit only drafts
           and applications returned for correction.

           RESUBMITTED applications are already back
           in the admin verification workflow.
        */

        if (
            ![
                'DRAFT',
                'CORRECTION REQUIRED'
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
            'applicationType',
            'academicYear',
            'currentSemester',
            'gender',
            'religion',
            'specialCategory',
            'deNotifiedTribes',
            'tribes',
            'institute',
            'tehsil',
            'hosteller',
            'class10Board',
            'class10Session',
            'class10RollNumber',
            'enrollment',
            'admissionDate',
            'attendance',
            'admitCard',
            'examinationYear',
            'promoted',
            'correspondenceAddress',
            'permanentAddress',
            'contactNumbers',
            'bankAddress',
            'bankBranchName',
            'previousPercentage',
            'previousQualification',
            'bankAccountNumber',
            'bankName',
            'ifscCode',
            'declarationAccepted'
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
                    req.body.previousPercentage
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

        if (req.body.attendance !== undefined && req.body.attendance !== null && req.body.attendance !== '') {
            const attendance = Number(req.body.attendance);
            if (!Number.isFinite(attendance) || attendance < 0 || attendance > 100) {
                return res.status(400).json({ success: false, message: 'Attendance must be between 0 and 100.' });
            }
            application.applicantDetails.attendance = attendance;
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

    let cleanupAlreadyCompleted =
        false;


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


        if (
            !documentType
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Document type is required.'

            });

        }


        if (
            documentType.length > 150
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid document type.'

            });

        }


        if (
            !req.file
        ) {

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

                _id:
                    req.params.id,

                student:
                    req.user.id

            }).populate(
                'scholarship'
            );


        if (
            !application
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Application not found.'

            });

        }


        if (
            ![
                'DRAFT',
                'CORRECTION REQUIRED'
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


        /* --------------------------------------------------------
           VALIDATE EXTENSION
        -------------------------------------------------------- */

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


        /* --------------------------------------------------------
           CLOUDINARY RAW AUTHENTICATED STORAGE
        -------------------------------------------------------- */

        const resourceType =
            'raw';


        const uniqueId =
            crypto.randomUUID();


        const publicId =
            `scholarships/${application._id}/${uniqueId}`;


        const uploadResult =
            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    const uploadStream =
                        cloudinary
                            .uploader
                            .upload_stream(

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


        /* --------------------------------------------------------
           STORE CLOUDINARY METADATA ONLY
        -------------------------------------------------------- */

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


        /* --------------------------------------------------------
           REPLACE EXISTING DOCUMENT OR ADD NEW
        -------------------------------------------------------- */

        if (
            existingDocumentIndex !==
            -1
        ) {

            application.documents[
                existingDocumentIndex
            ] =
                documentData;

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

                await cloudinary
                    .uploader
                    .destroy(

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

                await cloudinary
                    .uploader
                    .destroy(

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


        uploadedPublicId =
            null;


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

                await cloudinary
                    .uploader
                    .destroy(

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

                _id:
                    req.params.id,

                student:
                    req.user.id

            }).populate(
                'scholarship'
            );


        if (
            !application
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Application not found.'

            });

        }


        if (
            ![
                'DRAFT',
                'CORRECTION REQUIRED'
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


        if (
            !scholarship
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Scholarship information is unavailable.'

            });

        }


        /* --------------------------------------------------------
           APPLICATION WINDOW
        -------------------------------------------------------- */

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


        /* --------------------------------------------------------
           REQUIRED APPLICATION FIELDS
        -------------------------------------------------------- */

        const details =
            application.applicantDetails;


        const requiredFields = [
            'fullName',
            'studentId',
            'applicationType',
            'gender',
            'fatherName',
            'motherName',
            'familyIncome',
            'dateOfBirth',
            'category',
            'religion',
            'specialCategory',
            'aadhaarNumber',
            'deNotifiedTribes',
            'tribes',
            'institute',
            'tehsil',
            'course',
            'academicYear',
            'hosteller',
            'class10Board',
            'class10Session',
            'class10RollNumber',
            'enrollment',
            'admissionDate',
            'attendance',
            'admitCard',
            'examinationYear',
            'promoted',
            'correspondenceAddress',
            'permanentAddress',
            'contactNumbers',
            'emailAddress',
            'bankAccountNumber',
            'bankName',
            'ifscCode',
            'bankAddress',
            'bankBranchName'
        ];


        const missingFields =
            requiredFields.filter(
                (field) => {

                    const value =
                        details[field];


                    return (

                        value ===
                            undefined ||

                        value ===
                            null ||

                        value ===
                            ''

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

        if (!details.declarationAccepted) {
            return res.status(400).json({
                success: false,
                message: 'Accept the declaration before submitting the application.',
                missingFields: ['declarationAccepted']
            });
        }


        /* --------------------------------------------------------
           RECHECK ELIGIBILITY
        -------------------------------------------------------- */

            const eligibility =
            await checkStudentEligibility(

                req.user.id,

                scholarship._id,

                details

            );


        if (
            !eligibility.eligible
        ) {

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


        /* --------------------------------------------------------
           REQUIRED DOCUMENTS
        -------------------------------------------------------- */

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


        /* --------------------------------------------------------
           UPDATE APPLICATION STATUS
        -------------------------------------------------------- */

        const wasCorrectionRequired =
            application.status ===
            'CORRECTION REQUIRED';


        application.status =
            wasCorrectionRequired
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
                wasCorrectionRequired
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

    downloadApplicationPdf,

    getApplicationDocumentUrl,

    updateApplication,

    uploadApplicationDocument,

    submitApplication

};


async function downloadApplicationPdf(req, res) {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid application ID.' });
        }

        const query = { _id: req.params.id };
        if (req.user.role !== 'admin') query.student = req.user.id;
        const application = await ScholarshipApplication.findOne(query)
            .select('+aadhaarEncrypted')
            .populate('scholarship', 'name')
            .lean();

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        const details = application.applicantDetails || {};
        const printedAadhaar = decryptAadhaar(application.aadhaarEncrypted) || details.aadhaarNumber;
        const value = (item) => item === null || item === undefined || item === '' ? 'Not provided' : String(item);
        const date = (item) => item ? new Date(item).toLocaleDateString('en-IN') : 'Not provided';
        const page = [];
        addHeader(page, 'scholarship');
        addDocumentTitle(page, 'SCHOLARSHIP APPLICATION FORM', 'PERSONAL, ACADEMIC, CONTACT AND BANK DETAILS');
        addMetadataStrip(page, 685, [
            { label: 'Application Number', value: application.applicationNumber },
            { label: 'Application Type', value: details.applicationType },
            { label: 'Scheme Name', value: application.scholarship?.name }
        ]);
        addMetadataStrip(page, 656, [
            { label: 'Student ID', value: details.studentId },
            { label: 'Status', value: application.status },
            { label: 'Generated', value: new Date().toLocaleDateString('en-IN') }
        ]);

        addSection(page, 'PERSONAL DETAILS', 634, { height: 17, size: 8.1 });
        const compactPair = { labelSize: 6.6, valueSize: 7.4, labelWidth: 91 };
        addPairRow(page, 609, 20, { label: 'Student Name', value: details.fullName }, { label: 'Gender', value: details.gender }, compactPair);
        addPairRow(page, 588, 20, { label: "Father's Name", value: details.fatherName }, { label: "Mother's Name", value: details.motherName }, compactPair);
        addPairRow(page, 567, 20, { label: 'Annual Income', value: `Rs. ${value(details.familyIncome)}` }, { label: 'Date of Birth', value: date(details.dateOfBirth) }, compactPair);
        addPairRow(page, 546, 20, { label: 'Category', value: details.category }, { label: 'Religion', value: details.religion }, compactPair);
        addPairRow(page, 525, 20, { label: 'Special Category', value: details.specialCategory }, { label: 'Aadhaar (UID) No.', value: printedAadhaar }, { ...compactPair, labelSize: 6.3, valueSize: 7.1 });
        addPairRow(page, 504, 20, { label: 'De-Notified Tribes', value: details.deNotifiedTribes }, { label: 'Tribes', value: details.tribes }, { ...compactPair, labelSize: 6.3 });

        addSection(page, 'ACADEMIC DETAILS', 484, { height: 17, size: 8.1 });
        addFullRow(page, 462, 19, 'Institute', details.institute, { labelWidth: 105, labelSize: 6.7, valueSize: 7.3, leading: 8.3 });
        addFullRow(page, 441, 19, 'Course / Branch', [details.course, details.department].filter(Boolean).join(' / '), { labelWidth: 105, labelSize: 6.7, valueSize: 7.3, leading: 8.3 });
        addPairRow(page, 420, 19, { label: 'Tehsil', value: details.tehsil }, { label: 'Academic Year', value: details.academicYear }, compactPair);
        addPairRow(page, 399, 19, { label: 'Hosteller', value: details.hosteller }, { label: '10th Class Board', value: details.class10Board }, { ...compactPair, labelSize: 6.3 });
        addPairRow(page, 378, 19, { label: '10th Class Session', value: details.class10Session }, { label: '10th Roll Number', value: details.class10RollNumber }, { ...compactPair, labelSize: 6.3 });
        addPairRow(page, 357, 19, { label: 'Enrollment', value: details.enrollment }, { label: 'Admission Date', value: date(details.admissionDate) }, compactPair);
        addPairRow(page, 336, 19, { label: 'Attendance', value: details.attendance === null || details.attendance === undefined || details.attendance === '' ? '' : `${details.attendance}%` }, { label: 'Admit Card', value: details.admitCard }, compactPair);
        addPairRow(page, 315, 19, { label: 'Examination Year', value: details.examinationYear }, { label: 'Promoted', value: details.promoted }, compactPair);
        addFullRow(page, 294, 19, 'Previous Results', [details.previousPercentage === null || details.previousPercentage === undefined ? '' : `${details.previousPercentage}%`, details.previousQualification].filter(Boolean).join(' / '), { labelWidth: 105, labelSize: 6.7, valueSize: 7.3, leading: 8.3 });

        addSection(page, 'CONTACT DETAILS', 274, { height: 17, size: 8.1 });
        addFullRow(page, 251, 21, 'Correspondence Address', details.correspondenceAddress, { labelWidth: 120, labelSize: 6.4, valueSize: 7.1, leading: 7.5 });
        addFullRow(page, 227, 21, 'Permanent Address', details.permanentAddress, { labelWidth: 120, labelSize: 6.4, valueSize: 7.1, leading: 7.5 });
        addPairRow(page, 206, 19, { label: 'Contact Numbers', value: details.contactNumbers }, { label: 'Email Address', value: details.emailAddress }, { ...compactPair, labelSize: 6.2, valueSize: 7.0 });

        addSection(page, 'BANK DETAILS', 186, { height: 17, size: 8.1 });
        addPairRow(page, 165, 19, { label: 'Account Number', value: details.bankAccountNumber }, { label: 'Bank Name', value: details.bankName }, { ...compactPair, labelSize: 6.2, valueSize: 7.0 });
        addPairRow(page, 144, 19, { label: 'IFSC Code', value: details.ifscCode }, { label: 'Bank Branch Name', value: details.bankBranchName }, { ...compactPair, labelSize: 6.2, valueSize: 7.0 });
        addFullRow(page, 120, 21, 'Bank Address', details.bankAddress, { labelWidth: 120, labelSize: 6.4, valueSize: 7.1, leading: 7.5 });

        addSection(page, 'DECLARATION', 99, { height: 17, size: 8.1 });
        const declaration = `I, ${details.fullName || 'the applicant'}, declare that the information in this form is true and correct to the best of my knowledge. False information may result in recovery of the scholarship and further action.`;
        pdfRect(page, 32, 51, 531, 42, '#FFFFFF', '#C7D2DE');
        pdfText(page, declaration, 40, 83, { size: 7.1, width: 515, wrapAt: 112, leading: 8.5 });
        pdfText(page, details.declarationAccepted ? 'Declaration accepted electronically' : 'Declaration not yet accepted - draft copy', 40, 65, { size: 7.0, bold: true, color: details.declarationAccepted ? '#176B45' : '#9B2C2C' });
        pdfLine(page, 390, 60, 555, 60, '#7A8795', 0.7);
        pdfText(page, 'Student Signature', 390, 52, { size: 6.8, color: '#536273', width: 165, align: 'right' });
        const isDraft = String(application.status || '').toUpperCase() === 'DRAFT';
        addFooter(page, isDraft ? 'Draft copy - it remains private until you submit it.' : 'Submitted application record - keep this copy for your records.');

        const buffer = createFormPdf(page);
        const filename = `${String(application.applicationNumber || 'scholarship-application').replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        return res.send(buffer);
    } catch (error) {
        console.error('Download scholarship application PDF error:', error);
        return res.status(500).json({ success: false, message: 'Unable to generate the scholarship application PDF.' });
    }
}
