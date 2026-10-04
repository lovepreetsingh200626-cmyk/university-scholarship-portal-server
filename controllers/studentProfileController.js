const mongoose = require('mongoose');

const StudentProfile =
    require('../models/StudentProfile');


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


const isOptionalString = (
    value,
    maxLength = 200
) => {

    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return true;
    }

    return isValidString(
        value,
        1,
        maxLength
    );
};


const isValidMobile = (
    mobile
) => {

    if (
        mobile === undefined ||
        mobile === null ||
        mobile === ''
    ) {
        return true;
    }

    if (
        typeof mobile !== 'string'
    ) {
        return false;
    }

    return /^[0-9]{10}$/.test(
        mobile.trim()
    );
};


const isValidDate = (
    value
) => {

    if (
        value === undefined ||
        value === null ||
        value === ''
    ) {
        return true;
    }

    if (
        typeof value !== 'string'
    ) {
        return false;
    }

    const date =
        new Date(value);

    return !Number.isNaN(
        date.getTime()
    );
};


const isValidNumber = (
    value
) => {

    return (
        typeof value === 'number' &&
        Number.isFinite(value)
    );
};


/* ============================================================
   CREATE OR UPDATE STUDENT PROFILE
============================================================ */

const createOrUpdateProfile = async (
    req,
    res
) => {

    try {

        /* ========================================================
           AUTHENTICATED USER VALIDATION
        ======================================================== */

        if (
            !req.user ||
            !req.user.id ||
            !mongoose.isValidObjectId(
                req.user.id
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Authenticated student information is invalid.'
            });
        }


        /* ========================================================
           BASIC REQUEST VALIDATION
        ======================================================== */

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid student profile data.'
            });
        }


        /* ========================================================
           READ REQUEST DATA
        ======================================================== */

        const {
            fullName,
            registrationNumber,
            course,
            department,
            academicYear,
            currentSemester,
            category,
            gender,
            dateOfBirth,
            mobile,
            address,
            state,
            familyIncome,
            previousPercentage,
            previousQualification,
            bankAccountNumber,
            bankName,
            ifscCode
        } = req.body;


        /* ========================================================
           REQUIRED FIELD VALIDATION
        ======================================================== */

        if (
            fullName === undefined ||
            registrationNumber === undefined ||
            course === undefined ||
            department === undefined ||
            academicYear === undefined ||
            currentSemester === undefined ||
            category === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Full name, registration number, course, department, academic year, semester and category are required.'
            });
        }


        /* ========================================================
           REQUIRED STRING VALIDATION
        ======================================================== */

        if (
            !isValidString(
                fullName,
                2,
                100
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Full name must contain between 2 and 100 characters.'
            });
        }


        if (
            !isValidString(
                registrationNumber,
                1,
                50
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Registration number must be valid.'
            });
        }


        if (
            !isValidString(
                course,
                1,
                100
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Course must be valid.'
            });
        }


        if (
            !isValidString(
                department,
                1,
                100
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Department must be valid.'
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
                    'Academic year must be valid.'
            });
        }


        if (
            !isValidString(
                category,
                1,
                50
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Category must be valid.'
            });
        }


        /* ========================================================
           SEMESTER VALIDATION
        ======================================================== */

        const semester =
            Number(currentSemester);

        if (
            !Number.isFinite(
                semester
            ) ||
            !Number.isInteger(
                semester
            ) ||
            semester < 1 ||
            semester > 20
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Current semester must be a valid semester between 1 and 20.'
            });
        }


        /* ========================================================
           OPTIONAL STRING VALIDATION
        ======================================================== */

        if (
            !isOptionalString(
                gender,
                30
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Gender value is invalid.'
            });
        }


        if (
            !isOptionalString(
                address,
                500
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Address must not exceed 500 characters.'
            });
        }


        if (
            !isOptionalString(
                state,
                100
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'State value is invalid.'
            });
        }


        if (
            !isOptionalString(
                previousQualification,
                100
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Previous qualification is invalid.'
            });
        }


        if (
            !isOptionalString(
                bankName,
                150
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Bank name is invalid.'
            });
        }


        /* ========================================================
           MOBILE VALIDATION
        ======================================================== */

        if (
            !isValidMobile(
                mobile
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Mobile number must contain exactly 10 digits.'
            });
        }


        /* ========================================================
           DATE OF BIRTH VALIDATION
        ======================================================== */

        if (
            !isValidDate(
                dateOfBirth
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Date of birth must be a valid date.'
            });
        }


        if (
            dateOfBirth
        ) {

            const dob =
                new Date(
                    dateOfBirth
                );

            const now =
                new Date();

            if (
                dob > now
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Date of birth cannot be in the future.'
                });
            }
        }


        /* ========================================================
           PREVIOUS PERCENTAGE VALIDATION
        ======================================================== */

        let normalizedPreviousPercentage =
            null;

        if (
            previousPercentage !==
                undefined &&
            previousPercentage !==
                null &&
            previousPercentage !== ''
        ) {

            const percentage =
                Number(
                    previousPercentage
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
                        'Previous percentage must be a valid number between 0 and 100.'
                });
            }

            normalizedPreviousPercentage =
                percentage;
        }


        /* ========================================================
           FAMILY INCOME VALIDATION
        ======================================================== */

        let normalizedFamilyIncome =
            null;

        if (
            familyIncome !==
                undefined &&
            familyIncome !==
                null &&
            familyIncome !== ''
        ) {

            const income =
                Number(
                    familyIncome
                );

            if (
                !Number.isFinite(
                    income
                ) ||
                income < 0 ||
                income > 1000000000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Family income must be a valid non-negative amount.'
                });
            }

            normalizedFamilyIncome =
                income;
        }


        /* ========================================================
           BANK ACCOUNT VALIDATION
        ======================================================== */

        let normalizedBankAccountNumber =
            '';

        if (
            bankAccountNumber !==
                undefined &&
            bankAccountNumber !==
                null &&
            bankAccountNumber !== ''
        ) {

            if (
                typeof bankAccountNumber !==
                'string'
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Bank account number must be valid.'
                });
            }

            normalizedBankAccountNumber =
                bankAccountNumber.trim();

            if (
                !/^[0-9]{6,30}$/.test(
                    normalizedBankAccountNumber
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Bank account number must contain 6 to 30 digits.'
                });
            }
        }


        /* ========================================================
           IFSC VALIDATION
        ======================================================== */

        let normalizedIfsc =
            '';

        if (
            ifscCode !== undefined &&
            ifscCode !== null &&
            ifscCode !== ''
        ) {

            if (
                typeof ifscCode !==
                'string'
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'IFSC code must be valid.'
                });
            }

            normalizedIfsc =
                ifscCode
                    .trim()
                    .toUpperCase();

            if (
                !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
                    normalizedIfsc
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Please enter a valid IFSC code.'
                });
            }
        }


        /* ========================================================
           NORMALIZED VALUES
        ======================================================== */

        const normalizedFullName =
            fullName.trim();

        const normalizedRegistrationNumber =
            registrationNumber.trim();

        const normalizedCourse =
            course.trim();

        const normalizedDepartment =
            department.trim();

        const normalizedAcademicYear =
            academicYear.trim();

        const normalizedCategory =
            category.trim();

        const normalizedGender =
            gender
                ? gender.trim()
                : '';

        const normalizedMobile =
            mobile
                ? mobile.trim()
                : '';

        const normalizedAddress =
            address
                ? address.trim()
                : '';

        const normalizedState =
            state
                ? state.trim()
                : '';

        const normalizedPreviousQualification =
            previousQualification
                ? previousQualification.trim()
                : '';

        const normalizedBankName =
            bankName
                ? bankName.trim()
                : '';


        /* ========================================================
           CHECK EXISTING PROFILE
        ======================================================== */

        const existingProfile =
            await StudentProfile.findOne({
                user: req.user.id
            });


        /* ========================================================
           REGISTRATION NUMBER OWNERSHIP CHECK
        ======================================================== */

        const registrationExists =
            await StudentProfile.findOne({
                registrationNumber:
                    normalizedRegistrationNumber,

                user: {
                    $ne: req.user.id
                }
            });


        if (
            registrationExists
        ) {
            return res.status(409).json({
                success: false,
                message:
                    'This registration number is already associated with another student.'
            });
        }


        /* ========================================================
           PREPARE PROFILE DATA
        ======================================================== */

        const profileData = {

            user:
                req.user.id,

            fullName:
                normalizedFullName,

            registrationNumber:
                normalizedRegistrationNumber,

            course:
                normalizedCourse,

            department:
                normalizedDepartment,

            academicYear:
                normalizedAcademicYear,

            currentSemester:
                semester,

            category:
                normalizedCategory,

            gender:
                normalizedGender,

            dateOfBirth:
                dateOfBirth
                    ? new Date(
                        dateOfBirth
                    )
                    : null,

            mobile:
                normalizedMobile,

            address:
                normalizedAddress,

            state:
                normalizedState,

            familyIncome:
                normalizedFamilyIncome,

            previousPercentage:
                normalizedPreviousPercentage,

            previousQualification:
                normalizedPreviousQualification,

            bankAccountNumber:
                normalizedBankAccountNumber,

            bankName:
                normalizedBankName,

            ifscCode:
                normalizedIfsc,

            profileCompleted:
                true
        };


        /* ========================================================
           UPDATE EXISTING PROFILE
        ======================================================== */

        if (
            existingProfile
        ) {

            const profile =
                await StudentProfile.findOneAndUpdate(
                    {
                        user:
                            req.user.id
                    },
                    profileData,
                    {
                        new: true,
                        runValidators: true
                    }
                );

            return res.status(200).json({
                success: true,
                message:
                    'Student profile updated successfully.',
                profile
            });
        }


        /* ========================================================
           CREATE NEW PROFILE
        ======================================================== */

        const profile =
            await StudentProfile.create(
                profileData
            );


        return res.status(200).json({
            success: true,
            message:
                'Student profile created successfully.',
            profile
        });

    } catch (error) {

        console.error(
            'Student profile error:',
            error
        );


        /* --------------------------------------------------------
           DUPLICATE KEY
        -------------------------------------------------------- */

        if (
            error &&
            error.code === 11000
        ) {

            return res.status(409).json({
                success: false,
                message:
                    'This registration number is already in use.'
            });
        }


        /* --------------------------------------------------------
           VALIDATION ERROR
        -------------------------------------------------------- */

        if (
            error &&
            error.name ===
            'ValidationError'
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Student profile contains invalid data.'
            });
        }


        return res.status(500).json({
            success: false,
            message:
                'Unable to save student profile.'
        });
    }
};


/* ============================================================
   GET MY STUDENT PROFILE
============================================================ */

const getMyProfile = async (
    req,
    res
) => {

    try {

        /* ========================================================
           AUTHENTICATED USER VALIDATION
        ======================================================== */

        if (
            !req.user ||
            !req.user.id ||
            !mongoose.isValidObjectId(
                req.user.id
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Authenticated student information is invalid.'
            });
        }


        /* ========================================================
           FIND PROFILE
        ======================================================== */

        const profile =
            await StudentProfile.findOne({
                user:
                    req.user.id
            }).populate(
                'user',
                'name email mobile role'
            );


        /* ========================================================
           PROFILE DOES NOT EXIST
        ======================================================== */

        if (
            !profile
        ) {

            return res.status(200).json({
                success: true,
                profile: null,
                profileCompleted: false,
                message:
                    'Student profile has not been created yet.'
            });
        }


        /* ========================================================
           PROFILE FOUND
        ======================================================== */

        return res.status(200).json({
            success: true,
            profile,
            profileCompleted:
                profile.profileCompleted ===
                true
        });

    } catch (error) {

        console.error(
            'Get student profile error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to fetch student profile.'
        });
    }
};


/* ============================================================
   EXPORT
============================================================ */

module.exports = {
    createOrUpdateProfile,
    getMyProfile
};