const mongoose = require('mongoose');

const Scholarship =
    require('../models/Scholarship');


/* ============================================================
   CONSTANTS
============================================================ */

const ALLOWED_STATUS = [
    'DRAFT',
    'PUBLISHED',
    'CLOSED'
];

const MAX_AMOUNT =
    1000000000;

const SCHOLARSHIP_SCHEME_CATEGORIES = [
    'Pre-Matric',
    'Post-Matric',
    'Top Class',
    'Merit-cum-Means (MCM)',
    'Post-Matric / Top Class / MCM',
    'Other NSP Scheme'
];

const inferSchemeCategory = (name = '') => {
    const normalized = String(name).toLowerCase();
    if (/pre[\s-]*matric/.test(normalized)) return 'Pre-Matric';
    if (/top[\s-]*class/.test(normalized)) return 'Top Class';
    if (/merit[\s-]*cum[\s-]*means|\bmcm\b/.test(normalized)) return 'Merit-cum-Means (MCM)';
    if (/post[\s-]*matric/.test(normalized)) return 'Post-Matric';
    return 'Other NSP Scheme';
};


/* ============================================================
   VALIDATION HELPERS
============================================================ */

const isValidString = (
    value,
    minLength = 1,
    maxLength = 200
) => {

    if (
        typeof value !== 'string'
    ) {
        return false;
    }

    const trimmedValue =
        value.trim();

    return (
        trimmedValue.length >= minLength &&
        trimmedValue.length <= maxLength
    );
};


const normalizeStringArray = (
    value,
    maxItems,
    maxItemLength = 100
) => {

    if (
        value === undefined ||
        value === null
    ) {
        return [];
    }

    if (
        !Array.isArray(value) ||
        value.length > maxItems
    ) {
        return null;
    }

    const normalized = [];

    for (
        const item of value
    ) {

        if (
            typeof item !== 'string'
        ) {
            return null;
        }

        const trimmed =
            item.trim();

        if (
            !trimmed ||
            trimmed.length > maxItemLength
        ) {
            return null;
        }

        normalized.push(trimmed);
    }

    return [
        ...new Set(normalized)
    ];
};


const isValidObjectId = (
    id
) => {
    return mongoose.isValidObjectId(
        id
    );
};


/* ============================================================
   CREATE SCHOLARSHIP
============================================================ */

const createScholarship = async (
    req,
    res
) => {

    try {

        /* --------------------------------------------------------
           REQUEST VALIDATION
        -------------------------------------------------------- */

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship data.'
            });
        }


        const {
            name,
            description,
            academicYear,
            schemeCategory,
            eligibleCourses,
            eligibleDepartments,
            eligibleCategories,
            minimumPercentage,
            maximumFamilyIncome,
            scholarshipAmount,
            requiredDocuments,
            applicationStartDate,
            applicationEndDate,
            instructions,
            status
        } = req.body;


        /* --------------------------------------------------------
           REQUIRED FIELDS
        -------------------------------------------------------- */

        if (
            name === undefined ||
            description === undefined ||
            academicYear === undefined ||
            scholarshipAmount === undefined ||
            applicationStartDate === undefined ||
            applicationEndDate === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Name, description, academic year, scholarship amount, application dates are required.'
            });
        }


        /* --------------------------------------------------------
           BASIC STRING VALIDATION
        -------------------------------------------------------- */

        if (
            !isValidString(
                name,
                2,
                200
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship name must contain between 2 and 200 characters.'
            });
        }


        if (
            !isValidString(
                description,
                1,
                5000
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship description is invalid.'
            });
        }


        if (
            !isValidString(
                academicYear,
                1,
                20
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Academic year is invalid.'
            });
        }

        const normalizedSchemeCategory = schemeCategory || inferSchemeCategory(name);
        if (!SCHOLARSHIP_SCHEME_CATEGORIES.includes(normalizedSchemeCategory)) {
            return res.status(400).json({
                success: false,
                message: 'Select a valid scholarship category / scheme level.'
            });
        }


        /* --------------------------------------------------------
           ELIGIBILITY ARRAYS
        -------------------------------------------------------- */

        const normalizedCourses =
            normalizeStringArray(
                eligibleCourses,
                100,
                100
            );

        if (
            normalizedCourses === null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Eligible courses contain invalid data.'
            });
        }


        const normalizedDepartments =
            normalizeStringArray(
                eligibleDepartments,
                100,
                100
            );

        if (
            normalizedDepartments === null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Eligible departments contain invalid data.'
            });
        }


        const normalizedCategories =
            normalizeStringArray(
                eligibleCategories,
                50,
                50
            );

        if (
            normalizedCategories === null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Eligible categories contain invalid data.'
            });
        }


        const normalizedDocuments =
            normalizeStringArray(
                requiredDocuments,
                100,
                150
            );

        if (
            normalizedDocuments === null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Required documents contain invalid data.'
            });
        }


        /* --------------------------------------------------------
           MINIMUM PERCENTAGE
        -------------------------------------------------------- */

        let normalizedMinimumPercentage =
            0;

        if (
            minimumPercentage !== undefined &&
            minimumPercentage !== null &&
            minimumPercentage !== ''
        ) {

            const percentage =
                Number(minimumPercentage);

            if (
                !Number.isFinite(
                    percentage
                ) ||
                percentage < 0 ||
                percentage > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Minimum percentage must be between 0 and 100.'
                });
            }

            normalizedMinimumPercentage =
                percentage;
        }


        /* --------------------------------------------------------
           MAXIMUM FAMILY INCOME
        -------------------------------------------------------- */

        let normalizedMaximumIncome =
            null;

        if (
            maximumFamilyIncome !== undefined &&
            maximumFamilyIncome !== null &&
            maximumFamilyIncome !== ''
        ) {

            const income =
                Number(maximumFamilyIncome);

            if (
                !Number.isFinite(
                    income
                ) ||
                income < 0 ||
                income > MAX_AMOUNT
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Maximum family income must be a valid non-negative amount.'
                });
            }

            normalizedMaximumIncome =
                income;
        }


        /* --------------------------------------------------------
           SCHOLARSHIP AMOUNT
        -------------------------------------------------------- */

        const normalizedAmount =
            Number(scholarshipAmount);

        if (
            !Number.isFinite(
                normalizedAmount
            ) ||
            normalizedAmount < 0 ||
            normalizedAmount > MAX_AMOUNT
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship amount must be a valid non-negative amount.'
            });
        }


        /* --------------------------------------------------------
           DATE VALIDATION
        -------------------------------------------------------- */

        const startDate =
            new Date(
                applicationStartDate
            );

        const endDate =
            new Date(
                applicationEndDate
            );

        if (
            Number.isNaN(
                startDate.getTime()
            ) ||
            Number.isNaN(
                endDate.getTime()
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid application start or end date.'
            });
        }


        if (
            endDate <= startDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Application end date must be after the start date.'
            });
        }


        /* --------------------------------------------------------
           STATUS VALIDATION
        -------------------------------------------------------- */

        const normalizedStatus =
            status === undefined ||
            status === null ||
            status === ''
                ? 'DRAFT'
                : status;

        if (
            typeof normalizedStatus !==
            'string' ||
            !ALLOWED_STATUS.includes(
                normalizedStatus
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship status.'
            });
        }


        /* --------------------------------------------------------
           INSTRUCTIONS
        -------------------------------------------------------- */

        const normalizedInstructions =
            instructions === undefined ||
            instructions === null
                ? ''
                : instructions;

        if (
            !isValidString(
                normalizedInstructions,
                0,
                5000
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Scholarship instructions are invalid.'
            });
        }


        /* --------------------------------------------------------
           CREATE SCHOLARSHIP
        -------------------------------------------------------- */

        const scholarship =
            await Scholarship.create({

                name:
                    name.trim(),

                description:
                    description.trim(),

                academicYear:
                    academicYear.trim(),

                schemeCategory:
                    normalizedSchemeCategory,

                eligibleCourses:
                    normalizedCourses,

                eligibleDepartments:
                    normalizedDepartments,

                eligibleCategories:
                    normalizedCategories,

                minimumPercentage:
                    normalizedMinimumPercentage,

                maximumFamilyIncome:
                    normalizedMaximumIncome,

                scholarshipAmount:
                    normalizedAmount,

                requiredDocuments:
                    normalizedDocuments,

                applicationStartDate:
                    startDate,

                applicationEndDate:
                    endDate,

                instructions:
                    normalizedInstructions.trim(),

                status:
                    normalizedStatus,

                createdBy:
                    req.user.id
            });


        return res.status(201).json({
            success: true,
            message:
                'Scholarship created successfully.',
            scholarship
        });

    } catch (error) {

        console.error(
            'Create scholarship error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to create scholarship.'
        });
    }
};


/* ============================================================
   GET ALL SCHOLARSHIPS
============================================================ */

const getAllScholarships = async (
    req,
    res
) => {

    try {

        const scholarships =
            await Scholarship.find()
                .populate(
                    'createdBy',
                    'name email'
                )
                .sort({
                    createdAt: -1
                });

        return res.status(200).json({
            success: true,
            count:
                scholarships.length,
            scholarships
        });

    } catch (error) {

        console.error(
            'Get scholarships error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to fetch scholarships.'
        });
    }
};


/* ============================================================
   GET SINGLE SCHOLARSHIP
============================================================ */

const getScholarshipById = async (
    req,
    res
) => {

    try {

        const scholarshipId =
            req.params.id;

        if (
            !isValidObjectId(
                scholarshipId
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship ID.'
            });
        }


        const scholarship =
            await Scholarship.findById(
                scholarshipId
            ).populate(
                'createdBy',
                'name email'
            );


        if (!scholarship) {
            return res.status(404).json({
                success: false,
                message:
                    'Scholarship not found.'
            });
        }


        return res.status(200).json({
            success: true,
            scholarship
        });

    } catch (error) {

        console.error(
            'Get scholarship error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to fetch scholarship.'
        });
    }
};


/* ============================================================
   UPDATE SCHOLARSHIP
============================================================ */

const updateScholarship = async (
    req,
    res
) => {

    try {

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship data.'
            });
        }


        const scholarshipId =
            req.params.id;

        if (
            !isValidObjectId(
                scholarshipId
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship ID.'
            });
        }


        const scholarship =
            await Scholarship.findById(
                scholarshipId
            );


        if (!scholarship) {
            return res.status(404).json({
                success: false,
                message:
                    'Scholarship not found.'
            });
        }


        /* --------------------------------------------------------
           BASIC STRING FIELDS
        -------------------------------------------------------- */

        if (
            req.body.name !== undefined
        ) {

            if (
                !isValidString(
                    req.body.name,
                    2,
                    200
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Scholarship name is invalid.'
                });
            }

            scholarship.name =
                req.body.name.trim();
        }


        if (
            req.body.description !== undefined
        ) {

            if (
                !isValidString(
                    req.body.description,
                    1,
                    5000
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Scholarship description is invalid.'
                });
            }

            scholarship.description =
                req.body.description.trim();
        }


        if (
            req.body.academicYear !== undefined
        ) {

            if (
                !isValidString(
                    req.body.academicYear,
                    1,
                    20
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Academic year is invalid.'
                });
            }

            scholarship.academicYear =
                req.body.academicYear.trim();
        }

        if (req.body.schemeCategory !== undefined) {
            if (!SCHOLARSHIP_SCHEME_CATEGORIES.includes(req.body.schemeCategory)) {
                return res.status(400).json({
                    success: false,
                    message: 'Select a valid scholarship category / scheme level.'
                });
            }
            scholarship.schemeCategory = req.body.schemeCategory;
        }


        /* --------------------------------------------------------
           ARRAY FIELDS
        -------------------------------------------------------- */

        if (
            req.body.eligibleCourses !==
            undefined
        ) {

            const value =
                normalizeStringArray(
                    req.body.eligibleCourses,
                    100,
                    100
                );

            if (value === null) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Eligible courses contain invalid data.'
                });
            }

            scholarship.eligibleCourses =
                value;
        }


        if (
            req.body.eligibleDepartments !==
            undefined
        ) {

            const value =
                normalizeStringArray(
                    req.body.eligibleDepartments,
                    100,
                    100
                );

            if (value === null) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Eligible departments contain invalid data.'
                });
            }

            scholarship.eligibleDepartments =
                value;
        }


        if (
            req.body.eligibleCategories !==
            undefined
        ) {

            const value =
                normalizeStringArray(
                    req.body.eligibleCategories,
                    50,
                    50
                );

            if (value === null) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Eligible categories contain invalid data.'
                });
            }

            scholarship.eligibleCategories =
                value;
        }


        if (
            req.body.requiredDocuments !==
            undefined
        ) {

            const value =
                normalizeStringArray(
                    req.body.requiredDocuments,
                    100,
                    150
                );

            if (value === null) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Required documents contain invalid data.'
                });
            }

            scholarship.requiredDocuments =
                value;
        }


        /* --------------------------------------------------------
           MINIMUM PERCENTAGE
        -------------------------------------------------------- */

        if (
            req.body.minimumPercentage !==
            undefined
        ) {

            const percentage =
                Number(
                    req.body.minimumPercentage
                );

            if (
                !Number.isFinite(
                    percentage
                ) ||
                percentage < 0 ||
                percentage > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Minimum percentage must be between 0 and 100.'
                });
            }

            scholarship.minimumPercentage =
                percentage;
        }


        /* --------------------------------------------------------
           MAXIMUM FAMILY INCOME
        -------------------------------------------------------- */

        if (
            req.body.maximumFamilyIncome !==
            undefined
        ) {

            if (
                req.body.maximumFamilyIncome ===
                null ||
                req.body.maximumFamilyIncome ===
                ''
            ) {
                scholarship.maximumFamilyIncome =
                    null;
            } else {

                const income =
                    Number(
                        req.body.maximumFamilyIncome
                    );

                if (
                    !Number.isFinite(
                        income
                    ) ||
                    income < 0 ||
                    income > MAX_AMOUNT
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'Maximum family income is invalid.'
                    });
                }

                scholarship.maximumFamilyIncome =
                    income;
            }
        }


        /* --------------------------------------------------------
           SCHOLARSHIP AMOUNT
        -------------------------------------------------------- */

        if (
            req.body.scholarshipAmount !==
            undefined
        ) {

            const amount =
                Number(
                    req.body.scholarshipAmount
                );

            if (
                !Number.isFinite(
                    amount
                ) ||
                amount < 0 ||
                amount > MAX_AMOUNT
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Scholarship amount is invalid.'
                });
            }

            scholarship.scholarshipAmount =
                amount;
        }


        /* --------------------------------------------------------
           INSTRUCTIONS
        -------------------------------------------------------- */

        if (
            req.body.instructions !==
            undefined
        ) {

            if (
                typeof req.body.instructions !==
                'string' ||
                req.body.instructions.length >
                5000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Scholarship instructions are invalid.'
                });
            }

            scholarship.instructions =
                req.body.instructions.trim();
        }


        /* --------------------------------------------------------
           STATUS
        -------------------------------------------------------- */

        if (
            req.body.status !== undefined
        ) {

            if (
                typeof req.body.status !==
                'string' ||
                !ALLOWED_STATUS.includes(
                    req.body.status
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid scholarship status.'
                });
            }

            scholarship.status =
                req.body.status;
        }


        /* --------------------------------------------------------
           DATES
        -------------------------------------------------------- */

        if (
            req.body.applicationStartDate !==
            undefined
        ) {

            const startDate =
                new Date(
                    req.body.applicationStartDate
                );

            if (
                Number.isNaN(
                    startDate.getTime()
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid application start date.'
                });
            }

            scholarship.applicationStartDate =
                startDate;
        }


        if (
            req.body.applicationEndDate !==
            undefined
        ) {

            const endDate =
                new Date(
                    req.body.applicationEndDate
                );

            if (
                Number.isNaN(
                    endDate.getTime()
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid application end date.'
                });
            }

            scholarship.applicationEndDate =
                endDate;
        }


        if (
            scholarship.applicationEndDate <=
            scholarship.applicationStartDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Application end date must be after the start date.'
            });
        }


        /* --------------------------------------------------------
           SAVE
        -------------------------------------------------------- */

        await scholarship.save();


        return res.status(200).json({
            success: true,
            message:
                'Scholarship updated successfully.',
            scholarship
        });

    } catch (error) {

        console.error(
            'Update scholarship error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to update scholarship.'
        });
    }
};


/* ============================================================
   DELETE SCHOLARSHIP
============================================================ */

const deleteScholarship = async (
    req,
    res
) => {

    try {

        const scholarshipId =
            req.params.id;

        if (
            !isValidObjectId(
                scholarshipId
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid scholarship ID.'
            });
        }


        const scholarship =
            await Scholarship.findById(
                scholarshipId
            );


        if (!scholarship) {
            return res.status(404).json({
                success: false,
                message:
                    'Scholarship not found.'
            });
        }


        await scholarship.deleteOne();


        return res.status(200).json({
            success: true,
            message:
                'Scholarship deleted successfully.'
        });

    } catch (error) {

        console.error(
            'Delete scholarship error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to delete scholarship.'
        });
    }
};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    createScholarship,
    getAllScholarships,
    getScholarshipById,
    updateScholarship,
    deleteScholarship
};
