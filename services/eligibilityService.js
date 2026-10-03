const Scholarship = require('../models/Scholarship');
const StudentProfile = require('../models/StudentProfile');

/* ============================================================
   CHECK STUDENT ELIGIBILITY
============================================================ */

const checkStudentEligibility = async (
    studentUserId,
    scholarshipId
) => {
    const scholarship = await Scholarship.findById(
        scholarshipId
    );

    if (!scholarship) {
        return {
            eligible: false,
            reason: 'Scholarship not found.'
        };
    }

    const studentProfile =
        await StudentProfile.findOne({
            user: studentUserId
        });

    if (!studentProfile) {
        return {
            eligible: false,
            reason:
                'Student profile must be completed before checking eligibility.'
        };
    }

    const failedCriteria = [];

    /* ========================================================
       COURSE
    ======================================================== */

    if (
        scholarship.eligibleCourses.length > 0 &&
        !scholarship.eligibleCourses.includes(
            studentProfile.course
        )
    ) {
        failedCriteria.push(
            `Course must be one of: ${scholarship.eligibleCourses.join(
                ', '
            )}.`
        );
    }

    /* ========================================================
       DEPARTMENT
    ======================================================== */

    if (
        scholarship.eligibleDepartments.length > 0 &&
        !scholarship.eligibleDepartments.includes(
            studentProfile.department
        )
    ) {
        failedCriteria.push(
            `Department must be one of: ${scholarship.eligibleDepartments.join(
                ', '
            )}.`
        );
    }

    /* ========================================================
       CATEGORY
    ======================================================== */

    if (
        scholarship.eligibleCategories.length > 0 &&
        !scholarship.eligibleCategories.includes(
            studentProfile.category
        )
    ) {
        failedCriteria.push(
            `Category must be one of: ${scholarship.eligibleCategories.join(
                ', '
            )}.`
        );
    }

    /* ========================================================
       MINIMUM PERCENTAGE
    ======================================================== */

    if (
        scholarship.minimumPercentage > 0
    ) {
        if (
            studentProfile.previousPercentage === null ||
            studentProfile.previousPercentage === undefined
        ) {
            failedCriteria.push(
                'Previous percentage is required.'
            );
        } else if (
            studentProfile.previousPercentage <
            scholarship.minimumPercentage
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
        scholarship.maximumFamilyIncome !== null &&
        scholarship.maximumFamilyIncome !== undefined
    ) {
        if (
            studentProfile.familyIncome === null ||
            studentProfile.familyIncome === undefined
        ) {
            failedCriteria.push(
                'Family income is required.'
            );
        } else if (
            studentProfile.familyIncome >
            scholarship.maximumFamilyIncome
        ) {
            failedCriteria.push(
                `Maximum allowed family income is ₹${scholarship.maximumFamilyIncome}.`
            );
        }
    }

    /* ========================================================
       FINAL RESULT
    ======================================================== */

    if (failedCriteria.length > 0) {
        return {
            eligible: false,
            reason:
                'Student does not meet all eligibility criteria.',
            failedCriteria,
            scholarship: {
                id: scholarship._id,
                name: scholarship.name
            }
        };
    }

    return {
        eligible: true,
        reason:
            'Student meets all eligibility criteria.',
        failedCriteria: [],
        scholarship: {
            id: scholarship._id,
            name: scholarship.name,
            scholarshipAmount:
                scholarship.scholarshipAmount
        }
    };
};

module.exports = {
    checkStudentEligibility
};