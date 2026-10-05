const mongoose = require('mongoose');

const ScholarshipApplication =
    require('../models/ScholarshipApplication');


/* ============================================================
   ALLOWED APPLICATION STATUSES
============================================================ */

const allowedStatuses = [
    'SUBMITTED',
    'UNDER VERIFICATION',
    'CORRECTION REQUIRED',
    'RESUBMITTED',
    'VERIFIED',
    'SANCTIONED',
    'DISBURSED',
    'REJECTED'
];


/* ============================================================
   APPLICATION ID VALIDATION
============================================================ */

const validateApplicationId = (
    applicationId,
    res
) => {

    if (
        !applicationId
    ) {
        res.status(400).json({
            success: false,
            message:
                'Application ID is required.'
        });

        return false;
    }


    if (
        typeof applicationId !==
        'string' ||
        !mongoose.isValidObjectId(
            applicationId
        )
    ) {
        res.status(400).json({
            success: false,
            message:
                'Invalid application ID.'
        });

        return false;
    }


    return true;
};


/* ============================================================
   GET ALL APPLICATIONS FOR ADMIN
   OPTIONAL STATUS FILTER
============================================================ */

const getAllApplicationsForAdmin = async (
    req,
    res
) => {

    try {

        const {
            status
        } = req.query;


        // Student drafts stay private until they are submitted.
        const filter = {
            status: { $ne: 'DRAFT' }
        };


        /* --------------------------------------------------------
           STATUS FILTER
        -------------------------------------------------------- */

        if (
            status
        ) {

            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid application status filter.'
                });
            }


            filter.status =
                status;
        }


        /* --------------------------------------------------------
           FETCH APPLICATIONS
        -------------------------------------------------------- */

        const applications =
            await ScholarshipApplication.find(
                filter
            )
                .populate(
                    'student',
                    'name email mobile'
                )
                .populate(
                    'scholarship',
                    'name academicYear scholarshipAmount applicationStartDate applicationEndDate status'
                )
                .sort({
                    createdAt: -1
                });


        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */

        return res.status(200).json({
            success: true,

            count:
                applications.length,

            filter:
                status || 'ALL',

            applications
        });

    } catch (error) {

        console.error(
            'Admin get applications error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to fetch scholarship applications.'
        });
    }
};


/* ============================================================
   GET ONE APPLICATION FOR ADMIN
============================================================ */

const getApplicationByIdForAdmin = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        /* --------------------------------------------------------
           ID VALIDATION
        -------------------------------------------------------- */

        if (
            !validateApplicationId(
                id,
                res
            )
        ) {
            return;
        }


        /* --------------------------------------------------------
           FIND APPLICATION
        -------------------------------------------------------- */

        const application =
            await ScholarshipApplication.findOne({
                _id: id,
                status: { $ne: 'DRAFT' }
            })
                .populate(
                    'student',
                    'name email mobile role isActive createdAt'
                )
                .populate(
                    'scholarship',
                    'name description academicYear eligibleCourses eligibleDepartments eligibleCategories minimumPercentage maximumFamilyIncome scholarshipAmount requiredDocuments applicationStartDate applicationEndDate instructions status'
                );


        if (
            !application
        ) {

            return res.status(404).json({
                success: false,
                message:
                    'Scholarship application not found.'
            });
        }


        return res.status(200).json({
            success: true,
            application
        });

    } catch (error) {

        console.error(
            'Admin get application error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to fetch scholarship application.'
        });
    }
};


/* ============================================================
   START VERIFICATION
   SUBMITTED → UNDER VERIFICATION
============================================================ */

const startVerification = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        if (
            !validateApplicationId(
                id,
                res
            )
        ) {
            return;
        }


        const application =
            await ScholarshipApplication.findById(
                id
            );


        if (
            !application
        ) {

            return res.status(404).json({
                success: false,
                message:
                    'Scholarship application not found.'
            });
        }


        if (
            ![
                'SUBMITTED',
                'RESUBMITTED'
            ].includes(
                application.status
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Only submitted or resubmitted applications can be moved to verification.'
            });
        }


        application.status =
            'UNDER VERIFICATION';


        await application.save();


        return res.status(200).json({
            success: true,
            message:
                'Application moved to verification successfully.',
            application
        });

    } catch (error) {

        console.error(
            'Start verification error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to start application verification.'
        });
    }
};


/* ============================================================
   REQUEST CORRECTION
   UNDER VERIFICATION → CORRECTION REQUIRED
============================================================ */

const requestCorrection = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;

        const {
            correctionRemarks
        } = req.body;


        if (
            !validateApplicationId(
                id,
                res
            )
        ) {
            return;
        }


        /* --------------------------------------------------------
           REMARKS VALIDATION
        -------------------------------------------------------- */

        if (
            typeof correctionRemarks !==
                'string' ||
            !correctionRemarks.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Correction remarks are required.'
            });
        }


        const trimmedRemarks =
            correctionRemarks.trim();


        if (
            trimmedRemarks.length >
            2000
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Correction remarks cannot exceed 2000 characters.'
            });
        }


        /* --------------------------------------------------------
           FIND APPLICATION
        -------------------------------------------------------- */

        const application =
            await ScholarshipApplication.findById(
                id
            );


        if (
            !application
        ) {

            return res.status(404).json({
                success: false,
                message:
                    'Scholarship application not found.'
            });
        }


        /* --------------------------------------------------------
           STATUS VALIDATION
        -------------------------------------------------------- */

        if (
            application.status !==
            'UNDER VERIFICATION'
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Correction can only be requested for applications under verification.'
            });
        }


        /* --------------------------------------------------------
           UPDATE
        -------------------------------------------------------- */

        application.status =
            'CORRECTION REQUIRED';

        application.correctionRemarks =
            trimmedRemarks;


        await application.save();


        return res.status(200).json({
            success: true,
            message:
                'Correction has been requested successfully.',
            application
        });

    } catch (error) {

        console.error(
            'Request correction error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to request correction.'
        });
    }
};


/* ============================================================
   VERIFY APPLICATION
   UNDER VERIFICATION → VERIFIED
============================================================ */

const verifyApplication = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;

        const {
            verificationRemarks
        } = req.body;


        if (
            !validateApplicationId(
                id,
                res
            )
        ) {
            return;
        }


        /* --------------------------------------------------------
           OPTIONAL REMARKS VALIDATION
        -------------------------------------------------------- */

        if (
            verificationRemarks !==
                undefined &&
            (
                typeof verificationRemarks !==
                'string' ||
                verificationRemarks.trim()
                    .length >
                2000
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Verification remarks cannot exceed 2000 characters.'
            });
        }


        const application =
            await ScholarshipApplication.findById(
                id
            );


        if (
            !application
        ) {

            return res.status(404).json({
                success: false,
                message:
                    'Scholarship application not found.'
            });
        }


        if (
            application.status !==
            'UNDER VERIFICATION'
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Only applications under verification can be verified.'
            });
        }


        application.status =
            'VERIFIED';


        application.verificationRemarks =
            verificationRemarks
                ? verificationRemarks.trim()
                : '';


        application.verifiedAt =
            new Date();


        await application.save();


        return res.status(200).json({
            success: true,
            message:
                'Scholarship application verified successfully.',
            application
        });

    } catch (error) {

        console.error(
            'Verify application error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to verify scholarship application.'
        });
    }
};


/* ============================================================
   REJECT APPLICATION
   UNDER VERIFICATION → REJECTED
============================================================ */

const rejectApplication = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;

        const {
            rejectionReason
        } = req.body;


        if (
            !validateApplicationId(
                id,
                res
            )
        ) {
            return;
        }


        /* --------------------------------------------------------
           REJECTION REASON VALIDATION
        -------------------------------------------------------- */

        if (
            typeof rejectionReason !==
                'string' ||
            !rejectionReason.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Rejection reason is required.'
            });
        }


        const trimmedReason =
            rejectionReason.trim();


        if (
            trimmedReason.length >
            2000
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Rejection reason cannot exceed 2000 characters.'
            });
        }


        /* --------------------------------------------------------
           FIND APPLICATION
        -------------------------------------------------------- */

        const application =
            await ScholarshipApplication.findById(
                id
            );


        if (
            !application
        ) {

            return res.status(404).json({
                success: false,
                message:
                    'Scholarship application not found.'
            });
        }


        /* --------------------------------------------------------
           STATUS VALIDATION
        -------------------------------------------------------- */

        if (
            application.status !==
            'UNDER VERIFICATION'
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Only applications under verification can be rejected.'
            });
        }


        /* --------------------------------------------------------
           UPDATE
        -------------------------------------------------------- */

        application.status =
            'REJECTED';

        application.rejectionReason =
            trimmedReason;


        await application.save();


        return res.status(200).json({
            success: true,
            message:
                'Scholarship application rejected successfully.',
            application
        });

    } catch (error) {

        console.error(
            'Reject application error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to reject scholarship application.'
        });
    }
};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    getAllApplicationsForAdmin,
    getApplicationByIdForAdmin,
    startVerification,
    requestCorrection,
    verifyApplication,
    rejectApplication
};
