const mongoose = require('mongoose');

const ScholarshipApplication =
    require('../models/ScholarshipApplication');


/* ============================================================
   DISBURSE SCHOLARSHIP APPLICATION
   SANCTIONED → DISBURSED
============================================================ */

const disburseApplication = async (
    req,
    res
) => {

    try {

        const {
            id
        } = req.params;


        /* --------------------------------------------------------
           APPLICATION ID VALIDATION
        -------------------------------------------------------- */

        if (
            !id
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Application ID is required.'
            });
        }


        if (
            typeof id !== 'string' ||
            !mongoose.isValidObjectId(
                id
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application ID.'
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
           SANCTIONED → DISBURSED
        -------------------------------------------------------- */

        if (
            application.status !==
            'SANCTIONED'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Only sanctioned applications can be marked as disbursed.'
            });
        }


        /* --------------------------------------------------------
           UPDATE DISBURSEMENT STATUS
        -------------------------------------------------------- */

        application.status =
            'DISBURSED';

        application.disbursedAt =
            new Date();


        await application.save();


        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */

        return res.status(200).json({
            success: true,
            message:
                'Scholarship amount marked as disbursed successfully.',
            application
        });

    } catch (error) {

        console.error(
            'Disburse application error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to mark scholarship application as disbursed.'
        });
    }
};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    disburseApplication
};