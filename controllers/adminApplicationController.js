const ScholarshipApplication =
    require('../models/ScholarshipApplication');

/* ============================================================
   GET ALL APPLICATIONS FOR ADMIN
   OPTIONAL STATUS FILTER
============================================================ */

const getAllApplicationsForAdmin = async (req, res) => {
    try {
        const {
            status
        } = req.query;

        const filter = {};

        if (status) {
            const allowedStatuses = [
                'DRAFT',
                'SUBMITTED',
                'UNDER VERIFICATION',
                'CORRECTION REQUIRED',
                'RESUBMITTED',
                'VERIFIED',
                'SANCTIONED',
                'DISBURSED',
                'REJECTED'
            ];

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

            filter.status = status;
        }

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

        return res.status(200).json({
            success: true,
            count: applications.length,
            filter: status || 'ALL',
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

const getApplicationByIdForAdmin = async (req, res) => {
    try {
        const application =
            await ScholarshipApplication.findById(
                req.params.id
            )
                .populate(
                    'student',
                    'name email mobile role isActive createdAt'
                )
                .populate(
                    'scholarship',
                    'name description academicYear eligibleCourses eligibleDepartments eligibleCategories minimumPercentage maximumFamilyIncome scholarshipAmount requiredDocuments applicationStartDate applicationEndDate instructions status'
                );

        if (!application) {
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

const startVerification = async (req, res) => {
    try {
        const application =
            await ScholarshipApplication.findById(
                req.params.id
            );

        if (!application) {
            return res.status(404).json({
                success: false,
                message:
                    'Scholarship application not found.'
            });
        }

        if (
            application.status !==
            'SUBMITTED'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Only submitted applications can be moved to verification.'
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

const requestCorrection = async (req, res) => {
    try {
        const {
            correctionRemarks
        } = req.body;

        if (
            !correctionRemarks ||
            !correctionRemarks.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Correction remarks are required.'
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
                    'Correction can only be requested for applications under verification.'
            });
        }

        application.status =
            'CORRECTION REQUIRED';

        application.correctionRemarks =
            correctionRemarks.trim();

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

const verifyApplication = async (req, res) => {
    try {
        const {
            verificationRemarks
        } = req.body;

        const application =
            await ScholarshipApplication.findById(
                req.params.id
            );

        if (!application) {
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

const rejectApplication = async (req, res) => {
    try {
        const {
            rejectionReason
        } = req.body;

        if (
            !rejectionReason ||
            !rejectionReason.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Rejection reason is required.'
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
                    'Only applications under verification can be rejected.'
            });
        }

        application.status =
            'REJECTED';

        application.rejectionReason =
            rejectionReason.trim();

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