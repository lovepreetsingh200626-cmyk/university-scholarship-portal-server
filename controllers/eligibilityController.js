const {
    checkStudentEligibility
} = require('../services/eligibilityService');

/* ============================================================
   CHECK MY ELIGIBILITY
============================================================ */

const checkEligibility = async (req, res) => {
    try {
        const {
            scholarshipId
        } = req.params;

        if (!scholarshipId) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship ID is required.'
            });
        }

        const result =
            await checkStudentEligibility(
                req.user.id,
                scholarshipId
            );

        return res.status(200).json({
            success: true,
            eligible: result.eligible,
            reason: result.reason,
            failedCriteria:
                result.failedCriteria || [],
            scholarship:
                result.scholarship || null
        });

    } catch (error) {
        console.error(
            'Eligibility check error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to check scholarship eligibility.'
        });
    }
};

module.exports = {
    checkEligibility
};