const mongoose = require('mongoose');

const ScholarshipApplication =
    require('../models/ScholarshipApplication');


/* ============================================================
   SANCTION SCHOLARSHIP APPLICATION
   VERIFIED → SANCTIONED
============================================================ */

const sanctionApplication = async (
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
           VERIFIED → SANCTIONED
        -------------------------------------------------------- */

        if (
            application.status !==
            'VERIFIED'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Only verified applications can be sanctioned.'
            });
        }


        /* --------------------------------------------------------
           UPDATE SANCTION STATUS
        -------------------------------------------------------- */

        application.status =
            'SANCTIONED';

        application.sanctionedAt =
            new Date();


        await application.save();


        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */

        return res.status(200).json({
            success: true,
            message:
                'Scholarship application sanctioned successfully.',
            application
        });

    } catch (error) {

        console.error(
            'Sanction application error:',
            error
        );


        return res.status(500).json({
            success: false,
            message:
                'Unable to sanction scholarship application.'
        });
    }
};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    sanctionApplication
};