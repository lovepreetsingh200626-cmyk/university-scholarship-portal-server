const mongoose = require('mongoose');

const Scholarship =
    require('../models/Scholarship');

const FreeshipCardApplication =
    require('../models/FreeshipCardApplication');


/* ============================================================
   CHECK STUDENT ELIGIBILITY
============================================================ */

const checkStudentEligibility = async (
    studentUserId,
    scholarshipId,
    applicantDetails = null
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


    const freeshipCard = await FreeshipCardApplication.findOne({
        student: studentUserId,
        status: 'APPROVED'
    }).lean();

    if (!freeshipCard) {
        return {
            eligible: false,
            reason:
                'An approved Freeship Card is required before you can apply for a scholarship.',
            failedCriteria: [],
            freeshipCardApproved: false
        };
    }

    const personal = freeshipCard.personalDetails || {};
    const courseDetails = freeshipCard.courseDetails?.presentlyStudying || {};
    const details = {
        course: courseDetails.course || '',
        department: courseDetails.branch || '',
        category: personal.category || '',
        familyIncome: personal.annualFamilyIncome,
        previousPercentage: applicantDetails?.previousPercentage
    };
    const normalize = (value) => String(value ?? '').trim().toLowerCase();


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
                normalize(details.course)
            );

        const courseMatch = scholarship.eligibleCourses.some(
            (course) => normalize(course) === normalize(details.course)
        );

        if (!eligible && !courseMatch) {

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
                details.department
            );

        const departmentMatch = scholarship.eligibleDepartments.some(
            (department) => normalize(department) === normalize(details.department)
        );

        if (!eligible && !departmentMatch) {

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
                details.category
            );

        const categoryMatch = scholarship.eligibleCategories.some(
            (category) => normalize(category) === normalize(details.category)
        );

        if (!eligible && !categoryMatch) {

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
            details.previousPercentage;

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
            details.familyIncome;

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

        const needsApplicationDetails =
            failedCriteria.length === 1 &&
            failedCriteria.includes('Previous percentage is required.');

        return {
            eligible: false,

            reason:
                needsApplicationDetails
                    ? 'Enter your academic result details in the scholarship application to complete the eligibility check.'
                    : 'Student does not meet all eligibility criteria.',

            failedCriteria,
            freeshipCardApproved: true,
            needsApplicationDetails,

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
        freeshipCardApproved: true,
        needsApplicationDetails: false,

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
