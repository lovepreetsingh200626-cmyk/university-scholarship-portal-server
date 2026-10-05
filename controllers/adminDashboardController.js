const ScholarshipApplication =
    require('../models/ScholarshipApplication');


/* ============================================================
   GET ADMIN DASHBOARD STATISTICS
============================================================ */

const getDashboardStatistics = async (
    req,
    res
) => {

    try {

        /* ========================================================
           GET ALL APPLICATION COUNTS IN ONE QUERY
        ======================================================== */

        const statisticsResult =
            await ScholarshipApplication.aggregate([
                {
                    $match: {
                        status: { $ne: 'DRAFT' }
                    }
                },
                {
                    $group: {
                        _id: '$status',

                        count: {
                            $sum: 1
                        }
                    }
                }
            ]);


        /* ========================================================
           CREATE STATUS COUNT MAP
        ======================================================== */

        const statusCounts = {};


        statisticsResult.forEach(
            (item) => {

                statusCounts[item._id] =
                    item.count;
            }
        );


        /* ========================================================
           RESPONSE
        ======================================================== */

        const totalApplications =
            statisticsResult.reduce(
                (
                    total,
                    item
                ) => {
                    return (
                        total +
                        item.count
                    );
                },
                0
            );


        return res.status(200).json({

            success: true,

            statistics: {

                totalApplications,

                draftApplications:
                    statusCounts.DRAFT ||
                    0,

                submittedApplications:
                    statusCounts.SUBMITTED ||
                    0,

                underVerificationApplications:
                    statusCounts[
                        'UNDER VERIFICATION'
                    ] ||
                    0,

                correctionRequiredApplications:
                    statusCounts[
                        'CORRECTION REQUIRED'
                    ] ||
                    0,

                resubmittedApplications:
                    statusCounts.RESUBMITTED ||
                    0,

                verifiedApplications:
                    statusCounts.VERIFIED ||
                    0,

                sanctionedApplications:
                    statusCounts.SANCTIONED ||
                    0,

                disbursedApplications:
                    statusCounts.DISBURSED ||
                    0,

                rejectedApplications:
                    statusCounts.REJECTED ||
                    0
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
