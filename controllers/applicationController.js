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
    addApprovalStamp,
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

const { getAdminSignature } = require('../utils/adminSignature');


const crypto =
    require('crypto');

const path =
    require('path');

const { Readable } =
    require('stream');

const STUDENT_UNDERTAKING_TEXT = 'I declare that all details and documents submitted with this application are true, complete and genuine to the best of my knowledge. I accept responsibility for any information or document that is false or misleading, and understand that the application or benefits may be cancelled or recovered and that further action may be taken under applicable laws and rules in force in India.';


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
            personal.tehsil,
            personal.district,
            personal.state,
            personal.pinCode
        ].filter(Boolean).join(', ');
        const applicantDetails = {
            fullName: personal.fullName || student?.name || '',
            nameAsPerDomicileId: personal.fullName || student?.name || '',
            studentId: student?.studentId || personal.applicantId || '',
            registrationNumber: student?.studentId || '',
            applicationType: 'Fresh Application',
            course: presentCourse.course || '',
            academicYear: presentCourse.academicSession || '',
            presentYear: presentCourse.year || '',
            category: personal.category || '',
            fatherName: personal.fatherName || '',
            motherName: personal.motherName || '',
            dateOfBirth: personal.dateOfBirth || null,
            familyIncome: personal.annualFamilyIncome ?? null,
            aadhaarNumber: personal.aadhaarLastFour ? `XXXXXXXX${personal.aadhaarLastFour}` : '',
            specialCategory: 'No',
            specialCategoryType: '',
            deNotifiedTribes: String(personal.category || '').trim().toUpperCase() === 'DNT' ? 'Yes' : 'No',
            tribes: '',
            tehsil: personal.tehsil || '',
            mobile: student?.mobile || personal.mobile || '',
            contactNumbers: student?.mobile || personal.mobile || '',
            emailAddress: student?.email || personal.email || '',
            address,
            correspondenceAddress: address,
            permanentAddress: address,
            state: personal.state || '',
            permanentAddressState: personal.state || '',
            domicileState: personal.domicileState || personal.state || '',
            homeDistrict: personal.district || '',
            subDistrict: personal.tehsil || '',
            village: personal.village || '',
            pinCode: personal.pinCode || '',

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
                    'name schemeCategory description academicYear eligibleCourses eligibleDepartments eligibleCategories minimumPercentage maximumFamilyIncome scholarshipAmount requiredDocuments applicationStartDate applicationEndDate instructions status'
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
        delete applicationResponse.applicantDetails?.department;
        const fullAadhaar = decryptAadhaar(application.aadhaarEncrypted);
        delete applicationResponse.aadhaarEncrypted;
        const verifiedFreeship = await FreeshipCardApplication.findOne({
            student: req.user.id,
            status: 'APPROVED'
        }).select('personalDetails.fullName').lean();
        const verifiedName = verifiedFreeship?.personalDetails?.fullName
            || applicationResponse.applicantDetails.nameAsPerDomicileId
            || applicationResponse.applicantDetails.fullName;
        applicationResponse.applicantDetails.nameAsPerDomicileId = verifiedName;
        applicationResponse.applicantDetails.fullName = verifiedName;
        if (fullAadhaar) {
            applicationResponse.applicantDetails.aadhaarNumber = fullAadhaar;
            applicationResponse.applicantDetails.memberNumber = fullAadhaar;
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

            }).select('+aadhaarEncrypted');


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
            'presentRollNumber',
            'permanentAddressState',
            'gender',
            'maritalStatus',
            'parentProfession',
            'religion',
            'divyangjan',
            'deNotifiedTribes',
            'tribes',
            'institute',
            'instituteState',
            'instituteDistrict',
            'tehsil',
            'classStartDate',
            'presentYear',
            'section',
            'modeOfStudy',
            'hosteller',
            'enrollmentYear',
            'previousBoard',
            'previousPassingYear',
            'class10Percentage',
            'class12Board',
            'class12PassingYear',
            'class12RollNumber',
            'class12Percentage',
            'competitiveExamQualified',
            'competitiveExamConductedBy',
            'competitiveExamRollNumber',
            'competitiveExamYear',
            'domicileState',
            'domicileStateIdentificationNumber',
            'homeDistrict',
            'subDistrict',
            'village',
            'pinCode',
            'class10Board',
            'class10Session',
            'class10RollNumber',
            'enrollment',
            'permanentAddress',
            'previousPercentage',
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

        if ([
            'village',
            'subDistrict',
            'homeDistrict',
            'permanentAddressState',
            'pinCode'
        ].some((field) => req.body[field] !== undefined)) {
            application.applicantDetails.permanentAddress = [
                application.applicantDetails.village,
                application.applicantDetails.subDistrict,
                application.applicantDetails.homeDistrict,
                application.applicantDetails.permanentAddressState,
                application.applicantDetails.pinCode
            ].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
        }

        if (req.body.competitiveExamQualified === 'No') {
            application.applicantDetails.competitiveExamConductedBy = '';
            application.applicantDetails.competitiveExamRollNumber = '';
            application.applicantDetails.competitiveExamYear = '';
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

        ['class10Percentage', 'class12Percentage'].forEach((field) => {
            if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
                const percentage = Number(req.body[field]);
                application.applicantDetails[field] = percentage;
            }
        });
        for (const field of ['class10Percentage', 'class12Percentage']) {
            if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
                const percentage = Number(req.body[field]);
                if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
                    return res.status(400).json({ success: false, message: `${field} must be between 0 and 100.` });
                }
            }
        }


        await application.save();

        const applicationResponse = application.toObject();
        const verifiedFreeship = await FreeshipCardApplication.findOne({
            student: req.user.id,
            status: 'APPROVED'
        }).select('personalDetails.fullName').lean();
        const verifiedName = verifiedFreeship?.personalDetails?.fullName
            || applicationResponse.applicantDetails.nameAsPerDomicileId
            || applicationResponse.applicantDetails.fullName;
        applicationResponse.applicantDetails.nameAsPerDomicileId = verifiedName;
        applicationResponse.applicantDetails.fullName = verifiedName;
        const fullAadhaar = decryptAadhaar(application.aadhaarEncrypted);
        delete applicationResponse.aadhaarEncrypted;
        if (fullAadhaar) {
            applicationResponse.applicantDetails.aadhaarNumber = fullAadhaar;
            applicationResponse.applicantDetails.memberNumber = fullAadhaar;
        }

        return res.status(200).json({

            success: true,

            message:
                'Application updated successfully.',

            application: applicationResponse

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

        if (req.body?.undertakingAccepted !== true) {
            return res.status(400).json({
                success: false,
                message: 'Accept the student undertaking before submitting the application.'
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

        if (!['Yes', 'No'].includes(details.competitiveExamQualified)) {
            return res.status(400).json({
                success: false,
                message: 'Select Yes or No for Competitive Exam Qualified.',
                missingFields: ['competitiveExamQualified']
            });
        }


        const requiredFields = [
            'fullName',
            'gender',
            'maritalStatus',
            'fatherName',
            'motherName',
            'familyIncome',
            'dateOfBirth',
            'category',
            ...(details.deNotifiedTribes === 'Yes'
                || ['ST', 'SCHEDULED TRIBE', 'SCHEDULED TRIBES', 'DNT'].includes(String(details.category || '').trim().toUpperCase())
                ? ['tribes']
                : []),
            'religion',
            'parentProfession',
            'divyangjan',
            'aadhaarNumber',
            'deNotifiedTribes',
            'institute',
            'tehsil',
            'course',
            'hosteller',
            'permanentAddress',
            'domicileState',
            'permanentAddressState',
            'homeDistrict',
            'subDistrict',
            'village',
            'pinCode',
            'emailAddress',
            'mobile',
            'competitiveExamQualified',
            ...(details.competitiveExamQualified === 'Yes'
                ? ['competitiveExamConductedBy', 'competitiveExamRollNumber', 'competitiveExamYear']
                : [])
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

        application.undertakingAcceptance = {
            accepted: true,
            statement: STUDENT_UNDERTAKING_TEXT,
            acceptedAt: application.submittedAt,
            acceptedBy: req.user.id
        };


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
            .populate('scholarship', 'name schemeCategory')
            .populate({ path: 'sanctionedBy', select: 'name +adminSignatureData +adminSignatureType' })
            .populate({ path: 'verifiedBy', select: 'name +adminSignatureData +adminSignatureType' })
            .populate({ path: 'rejectedBy', select: 'name +adminSignatureData +adminSignatureType' })
            .lean();

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        const details = application.applicantDetails || {};
        const freeshipStudentMatches = [
            ...(application.student ? [{ student: application.student }] : []),
            ...(details.studentId ? [{ 'personalDetails.applicantId': details.studentId }] : [])
        ];
        const verifiedFreeship = freeshipStudentMatches.length
            ? await FreeshipCardApplication.findOne({
                status: 'APPROVED',
                $or: freeshipStudentMatches
            })
            .select('personalDetails.fullName reviewedBy')
            .populate({ path: 'reviewedBy', select: 'name +adminSignatureData +adminSignatureType' })
            .sort({ reviewedAt: -1 })
            .lean()
            : null;
        const verifiedName = verifiedFreeship?.personalDetails?.fullName
            || details.nameAsPerDomicileId
            || details.fullName;
        const isRejected = application.status === 'REJECTED';
        const hasAuthorityDecision = ['VERIFIED', 'SANCTIONED', 'DISBURSED', 'REJECTED'].includes(application.status);
        const verifiedAdmin = application.status === 'VERIFIED'
            ? application.verifiedBy
            : isRejected ? application.rejectedBy : application.sanctionedBy;
        const canShowAuthorityStamp = hasAuthorityDecision;
        const recordedSignature = verifiedAdmin?.adminSignatureData && ['image/png', 'image/jpeg'].includes(verifiedAdmin.adminSignatureType)
            ? { name: verifiedAdmin.name || 'Portal Administrator', image: { data: Buffer.from(verifiedAdmin.adminSignatureData), type: verifiedAdmin.adminSignatureType } }
            : null;
        const freeshipReviewer = verifiedFreeship?.reviewedBy;
        const freeshipReviewerSignature = freeshipReviewer?.adminSignatureData && ['image/png', 'image/jpeg'].includes(freeshipReviewer.adminSignatureType)
            ? { name: freeshipReviewer.name || 'Portal Administrator', image: { data: Buffer.from(freeshipReviewer.adminSignatureData), type: freeshipReviewer.adminSignatureType } }
            : null;
        // Prefer the administrator who recorded this decision. The Freeship
        // PDFs use the reviewer's saved signature even if it is no longer
        // globally active. Reuse that approved reviewer signature if the
        // scholarship verifier account has no image saved.
        const portalSignature = recordedSignature || (canShowAuthorityStamp && freeshipReviewerSignature) || (canShowAuthorityStamp
            ? (await getAdminSignature(verifiedAdmin?._id) || await getAdminSignature())
            : null);
        const signatureName = portalSignature?.name || verifiedAdmin?.name || 'Portal Administrator';
        const approvalTimestamp = application.status === 'VERIFIED' ? application.verifiedAt : isRejected ? application.rejectedAt : application.sanctionedAt;
        let printedAadhaar = details.aadhaarNumber || '';
        try {
            printedAadhaar = decryptAadhaar(application.aadhaarEncrypted) || printedAadhaar;
        } catch (aadhaarError) {
            console.warn('Application PDF Aadhaar decryption failed; using the saved applicant detail:', aadhaarError.message);
        }
        const date = (item) => item ? new Date(item).toLocaleDateString('en-IN') : '';
        const dateTime = (item) => item ? new Date(item).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not applicable';
        const schemeName = String(application.scholarship?.name || '').toLowerCase();
        const schemeCategory = application.scholarship?.schemeCategory
            || (/pre[\s-]*matric/.test(schemeName) ? 'Pre-Matric'
                : /top[\s-]*class/.test(schemeName) ? 'Top Class'
                    : /merit[\s-]*cum[\s-]*means|\bmcm\b/.test(schemeName) ? 'Merit-cum-Means (MCM)'
                        : /post[\s-]*matric/.test(schemeName) ? 'Post-Matric' : 'Other NSP Scheme');
        const page = [];
        addHeader(page, 'scholarship');
        addDocumentTitle(page, 'SCHOLARSHIP APPLICATION FORM', 'APPLICANT, ACADEMIC AND ADDRESS DETAILS');
        addMetadataStrip(page, 683, [
            { label: 'Application ID', value: application.applicationNumber },
            { label: 'Applied for Scheme', value: application.scholarship?.name },
            { label: 'Registration Date', value: date(application.createdAt) }
        ]);
        const pairStyle = { labelSize: 5.5, valueSize: 6.2, minValueSize: 4.8, labelWidth: 82 };
        let y = 663;
        let hasSection = false;
        const section = (title) => {
            if (hasSection) y -= 13;
            addSection(page, title, y, { height: 14, size: 7.2 });
            y -= 17;
            hasSection = true;
        };
        const pair = (left, right = { label: '', value: '' }, rowStyle = pairStyle) => {
            addPairRow(page, y - 13, 14, left, right, rowStyle);
            y -= 15;
        };
        const full = (label, value, height = 15, rowOptions = {}) => {
            addFullRow(page, y - height + 1, height, label, value, {
                labelWidth: 110, labelSize: 5.4, valueSize: 6.1, leading: 7,
                wrapAt: 110, ...rowOptions
            });
            y -= height + 2;
        };

        section('BASIC DETAILS');
        [
            [{ label: 'Student ID', value: details.studentId }, { label: 'Domicile State', value: details.domicileState }],
            [{ label: 'Scholarship Category', value: schemeCategory }, { label: 'Student Name', value: verifiedName }],
            [{ label: 'Date of Birth', value: date(details.dateOfBirth) }, { label: 'Gender', value: details.gender }],
            [{ label: 'Marital Status', value: details.maritalStatus }, { label: 'Community / Category', value: details.category }],
            [{ label: 'Religion', value: details.religion }, { label: "Parent's Profession", value: details.parentProfession }],
            [{ label: 'Family Income', value: details.familyIncome }, { label: "Father's Name", value: details.fatherName }],
            [{ label: "Mother's Name", value: details.motherName }, { label: 'Email', value: details.emailAddress }],
            [{ label: 'Mobile', value: details.mobile }, { label: 'Aadhaar', value: printedAadhaar }],
            [{ label: 'DNT', value: details.deNotifiedTribes }, { label: 'DNT / ST Community', value: details.tribes && details.tribes !== 'NA' ? details.tribes : '' }],
            [{ label: 'Divyangjan', value: details.divyangjan }, { label: '', value: '' }]
        ].forEach((row) => pair(row[0], row[1]));

        section('APPLICATION SPECIFIC DETAILS');
        pair(
            { label: 'Domicile ID No.', value: details.domicileStateIdentificationNumber },
            { label: 'Member No.', value: printedAadhaar || details.memberNumber }
        );
        full('Name on Domicile ID', verifiedName);

        section('ACADEMIC DETAILS');
        [
            [{ label: 'Institute', value: details.institute }, { label: 'Tehsil', value: details.tehsil }],
            [{ label: 'Course', value: details.course }, { label: 'Course Start', value: date(details.classStartDate) }],
            [{ label: 'Present Year / Class', value: details.presentYear }, { label: 'Roll No.', value: details.presentRollNumber }],
            [{ label: 'Section', value: details.section }, { label: 'Enrollment No.', value: details.enrollment }],
            [{ label: 'Enrollment Year', value: details.enrollmentYear }, { label: 'Study Mode', value: details.modeOfStudy }],
            [{ label: 'Day Scholar / Hosteller', value: details.hosteller }, { label: 'Previous Board', value: details.previousBoard }],
            [{ label: 'Previous Passing Year', value: details.previousPassingYear }, { label: 'Previous Percentage', value: details.previousPercentage }],
            [{ label: '10th Board', value: details.class10Board }, { label: '10th Passing Year', value: details.class10Session }],
            [{ label: '10th Roll No.', value: details.class10RollNumber }, { label: '10th Percentage', value: details.class10Percentage }],
            [{ label: '12th Board', value: details.class12Board }, { label: '12th Passing Year', value: details.class12PassingYear }],
            [{ label: '12th Roll No.', value: details.class12RollNumber }, { label: '12th Percentage', value: details.class12Percentage }],
            [{ label: 'Competitive Exam', value: details.competitiveExamQualified }, { label: 'Exam Conducted By', value: details.competitiveExamQualified === 'Yes' ? details.competitiveExamConductedBy : '' }],
            ...(details.competitiveExamQualified === 'Yes'
                ? [[{ label: 'Exam Roll No.', value: details.competitiveExamRollNumber }, { label: 'Exam Year', value: details.competitiveExamYear }]]
                : [])
        ].forEach((row) => pair(row[0], row[1]));

        section('PERMANENT ADDRESS');
        const addressPairStyle = canShowAuthorityStamp
            ? { ...pairStyle, x: 32, width: 338, labelWidth: 58, labelSize: 5.1, valueSize: 5.8, minValueSize: 4.5 }
            : pairStyle;
        const addressRowOptions = canShowAuthorityStamp
            ? { width: 338, labelWidth: 67, labelSize: 5.2, valueSize: 5.9, minValueSize: 4.6 }
            : {};
        pair(
            { label: 'Permanent State', value: details.permanentAddressState },
            { label: 'Home District', value: details.homeDistrict },
            addressPairStyle
        );
        pair(
            { label: 'Sub District', value: details.subDistrict },
            { label: 'PIN Code', value: details.pinCode },
            addressPairStyle
        );
        full('Village / Town', details.village, 15, addressRowOptions);
        full('Address', details.permanentAddress, 25, addressRowOptions);
        if (canShowAuthorityStamp) {
            addApprovalStamp(page, 472, 163, 36, { orgLabel: 'SCHOLARSHIP PORTAL', centerLabel: isRejected ? 'REJECTED' : application.status === 'VERIFIED' ? 'VERIFIED' : 'APPROVED', footerLabel: isRejected ? 'REJECTION RECORD' : application.status === 'VERIFIED' ? 'VERIFICATION RECORD' : 'OFFICIAL RECORD', color: isRejected ? '#9D2D35' : '#176B45', fill: isRejected ? '#FFF9F7' : '#F3FBF6' });
            if (portalSignature?.image) page.push({ image: true, imageKey: 'adminSignature', x: 417, y: 99, width: 110, height: 15 });
            pdfText(page, 'Digitally signed by', 385, 116, { size: 6.1, bold: true, color: '#344B65', width: 174, align: 'center' });
            pdfText(page, signatureName, 385, 88, { size: 7.1, bold: true, color: '#143E68', width: 174, align: 'center' });
            pdfText(page, 'Date & time: ' + dateTime(approvalTimestamp), 380, 76, { size: 5.7, color: '#536273', width: 184, align: 'center' });
        }

        const requiredDocuments = Array.isArray(application.scholarship?.requiredDocuments)
            ? application.scholarship.requiredDocuments
            : [];
        const uploadedDocuments = Array.isArray(application.documents) ? application.documents : [];
        const uploadedRequiredCount = requiredDocuments.filter((type) =>
            uploadedDocuments.some((document) => document.documentType === type)
        ).length;
        const documentSummary = requiredDocuments.length
            ? `Supporting documents uploaded: ${uploadedRequiredCount} of ${requiredDocuments.length} required`
            : `Supporting documents uploaded: ${uploadedDocuments.length}`;
        pdfText(page, documentSummary, 38, 67, { size: 6.1, color: '#536273', width: 519 });
        pdfLine(page, 38, 51, 210, 51, '#7B8794', 0.7);
        pdfText(page, 'Applicant signature', 38, 41, { size: 6, color: '#536273', width: 172, align: 'center' });
        if (!canShowAuthorityStamp) {
            pdfText(page, 'Authority verification pending', 383, 41, { size: 5.8, color: '#536273', width: 172, align: 'center' });
        }
        addFooter(page, canShowAuthorityStamp ? 'Authority-reviewed scholarship record' : 'Student application form');

        let buffer;
        if (portalSignature?.image) {
            try {
                buffer = createFormPdf(page, { images: { adminSignature: portalSignature.image } });
            } catch (signatureImageError) {
                console.warn('Application PDF signature image could not be embedded; continuing without signature:', signatureImageError.message);
                buffer = createFormPdf(page);
            }
        } else {
            buffer = createFormPdf(page);
        }        const filename = `${String(application.applicationNumber || 'scholarship-application').replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        return res.send(buffer);
    } catch (error) {
        console.error('Download scholarship application PDF error:', error);
        const response = { success: false, message: 'Unable to generate the scholarship application PDF.' };
        if (process.env.NODE_ENV !== 'production') response.detail = error.message;
        return res.status(500).json(response);
    }
}
