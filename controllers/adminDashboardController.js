const ScholarshipApplication =
    require('../models/ScholarshipApplication');

/* ============================================================
   GET ADMIN DASHBOARD STATISTICS
============================================================ */

const getDashboardStatistics = async (req, res) => {
    try {
        const totalApplications =
            await ScholarshipApplication.countDocuments();

        const draftApplications =
            await ScholarshipApplication.countDocuments({
                status: 'DRAFT'
            });

        const submittedApplications =
            await ScholarshipApplication.countDocuments({
                status: 'SUBMITTED'
            });

        const underVerificationApplications =
            await ScholarshipApplication.countDocuments({
                status: 'UNDER VERIFICATION'
            });

        const correctionRequiredApplications =
            await ScholarshipApplication.countDocuments({
                status: 'CORRECTION REQUIRED'
            });

        const resubmittedApplications =
            await ScholarshipApplication.countDocuments({
                status: 'RESUBMITTED'
            });

        const verifiedApplications =
            await ScholarshipApplication.countDocuments({
                status: 'VERIFIED'
            });

        const sanctionedApplications =
            await ScholarshipApplication.countDocuments({
                status: 'SANCTIONED'
            });

        const disbursedApplications =
            await ScholarshipApplication.countDocuments({
                status: 'DISBURSED'
            });

        const rejectedApplications =
            await ScholarshipApplication.countDocuments({
                status: 'REJECTED'
            });

        return res.status(200).json({
            success: true,

            statistics: {
                totalApplications,

                draftApplications,

                submittedApplications,

                underVerificationApplications,

                correctionRequiredApplications,

                resubmittedApplications,

                verifiedApplications,

                sanctionedApplications,

                disbursedApplications,

                rejectedApplications
            }
        });

    } catch (error) {
        console.error(
            'Admin dashboard statistics error:',
            error
        );

        return res.status(500).json({
            success: false,

            message:
                'Unable to fetch dashboard statistics.'
        });
    }
};

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    getDashboardStatistics
};