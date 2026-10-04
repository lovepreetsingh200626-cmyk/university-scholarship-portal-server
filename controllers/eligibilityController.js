const mongoose = require('mongoose');

const {
    checkStudentEligibility
} = require('../services/eligibilityService');


/* ============================================================
   CHECK MY ELIGIBILITY
============================================================ */

const checkEligibility = async (
    req,
    res
) => {

    try {

        const {
            scholarshipId
        } = req.params;


        /* --------------------------------------------------------
           SCHOLARSHIP ID VALIDATION
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
            typeof scholarshipId !==
            'string' ||
            !mongoose.isValidObjectId(
                scholarshipId
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship ID.'
            });
        }


        /* --------------------------------------------------------
           CHECK ELIGIBILITY
        -------------------------------------------------------- */

        const result =
            await checkStudentEligibility(
                req.user.id,
                scholarshipId
            );


        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */

        return res.status(200).json({
            success: true,

            eligible:
                Boolean(
                    result.eligible
                ),

            reason:
                result.reason || '',

            failedCriteria:
                Array.isArray(
                    result.failedCriteria
                )
                    ? result.failedCriteria
                    : [],

            scholarship:
                result.scholarship ||
                null
        });

    } catch (error) {

        console.error(
            'Eligibility check error:',
            error
        );


        /* --------------------------------------------------------
           KNOWN SERVICE ERROR
        -------------------------------------------------------- */

        if (
            error &&
            error.name ===
            'CastError'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship ID.'
            });
        }


        /* --------------------------------------------------------
           SERVER ERROR
        -------------------------------------------------------- */

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