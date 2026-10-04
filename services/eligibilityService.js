const mongoose = require('mongoose');

const Scholarship =
    require('../models/Scholarship');

const StudentProfile =
    require('../models/StudentProfile');


/* ============================================================
   CHECK STUDENT ELIGIBILITY
============================================================ */

const checkStudentEligibility = async (
    studentUserId,
    scholarshipId
) => {

    /* --------------------------------------------------------
       INPUT VALIDATION
    -------------------------------------------------------- */

    if (
        !studentUserId ||
        !mongoose.isValidObjectId(
            studentUserId
        )
    ) {
        return {
            eligible: false,
            reason:
                'Invalid student information.',
            failedCriteria: []
        };
    }


    if (
        !scholarshipId ||
        !mongoose.isValidObjectId(
            scholarshipId
        )
    ) {
        return {
            eligible: false,
            reason:
                'Invalid scholarship information.',
            failedCriteria: []
        };
    }


    /* --------------------------------------------------------
       FIND SCHOLARSHIP
    -------------------------------------------------------- */

    const scholarship =
        await Scholarship.findById(
            scholarshipId
        ).lean();


    if (!scholarship) {
        return {
            eligible: false,
            reason:
                'Scholarship not found.',
            failedCriteria: []
        };
    }


    /* --------------------------------------------------------
       SCHOLARSHIP STATUS
    -------------------------------------------------------- */

    if (
        scholarship.status !==
        'PUBLISHED'
    ) {
        return {
            eligible: false,
            reason:
                'This scholarship is not currently available for application.',
            failedCriteria: [],
            scholarship: {
                id: scholarship._id,
                name: scholarship.name
            }
        };
    }


    /* --------------------------------------------------------
       FIND STUDENT PROFILE
    -------------------------------------------------------- */

    const studentProfile =
        await StudentProfile.findOne({
            user: studentUserId
        }).lean();


    if (!studentProfile) {
        return {
            eligible: false,
            reason:
                'Student profile must be completed before checking eligibility.',
            failedCriteria: []
        };
    }


    const failedCriteria = [];


    /* ========================================================
       COURSE
    ======================================================== */

    if (
        Array.isArray(
            scholarship.eligibleCourses
        ) &&
        scholarship.eligibleCourses.length > 0
    ) {

        const eligible =
            scholarship.eligibleCourses.includes(
                studentProfile.course
            );

        if (!eligible) {

            failedCriteria.push(
                `Course must be one of: ${scholarship.eligibleCourses.join(
                    ', '
                )}.`
            );
        }
    }


    /* ========================================================
       DEPARTMENT
    ======================================================== */

    if (
        Array.isArray(
            scholarship.eligibleDepartments
        ) &&
        scholarship.eligibleDepartments.length > 0
    ) {

        const eligible =
            scholarship.eligibleDepartments.includes(
                studentProfile.department
            );

        if (!eligible) {

            failedCriteria.push(
                `Department must be one of: ${scholarship.eligibleDepartments.join(
                    ', '
                )}.`
            );
        }
    }


    /* ========================================================
       CATEGORY
    ======================================================== */

    if (
        Array.isArray(
            scholarship.eligibleCategories
        ) &&
        scholarship.eligibleCategories.length > 0
    ) {

        const eligible =
            scholarship.eligibleCategories.includes(
                studentProfile.category
            );

        if (!eligible) {

            failedCriteria.push(
                `Category must be one of: ${scholarship.eligibleCategories.join(
                    ', '
                )}.`
            );
        }
    }


    /* ========================================================
       MINIMUM PERCENTAGE
    ======================================================== */

    if (
        Number(
            scholarship.minimumPercentage
        ) > 0
    ) {

        const percentage =
            studentProfile.previousPercentage;

        if (
            percentage === null ||
            percentage === undefined ||
            !Number.isFinite(
                Number(percentage)
            )
        ) {

            failedCriteria.push(
                'Previous percentage is required.'
            );

        } else if (
            Number(percentage) <
            Number(
                scholarship.minimumPercentage
            )
        ) {

            failedCriteria.push(
                `Minimum required percentage is ${scholarship.minimumPercentage}%.`
            );
        }
    }


    /* ========================================================
       MAXIMUM FAMILY INCOME
    ======================================================== */

    if (
        scholarship.maximumFamilyIncome !==
            null &&
        scholarship.maximumFamilyIncome !==
            undefined
    ) {

        const familyIncome =
            studentProfile.familyIncome;

        if (
            familyIncome === null ||
            familyIncome === undefined ||
            !Number.isFinite(
                Number(familyIncome)
            )
        ) {

            failedCriteria.push(
                'Family income is required.'
            );

        } else if (
            Number(familyIncome) >
            Number(
                scholarship.maximumFamilyIncome
            )
        ) {

            failedCriteria.push(
                `Maximum allowed family income is ₹${scholarship.maximumFamilyIncome}.`
            );
        }
    }


    /* ========================================================
       FINAL RESULT — NOT ELIGIBLE
    ======================================================== */

    if (
        failedCriteria.length > 0
    ) {

        return {
            eligible: false,

            reason:
                'Student does not meet all eligibility criteria.',

            failedCriteria,

            scholarship: {
                id:
                    scholarship._id,

                name:
                    scholarship.name
            }
        };
    }


    /* ========================================================
       FINAL RESULT — ELIGIBLE
    ======================================================== */

    return {
        eligible: true,

        reason:
            'Student meets all eligibility criteria.',

        failedCriteria: [],

        scholarship: {
            id:
                scholarship._id,

            name:
                scholarship.name,

            scholarshipAmount:
                scholarship.scholarshipAmount
        }
    };
};


module.exports = {
    checkStudentEligibility
};