const StudentProfile = require('../models/StudentProfile');

/* ============================================================
   CREATE OR UPDATE STUDENT PROFILE
============================================================ */

const createOrUpdateProfile = async (req, res) => {
    try {
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
            !fullName ||
            !registrationNumber ||
            !course ||
            !department ||
            !academicYear ||
            currentSemester === undefined ||
            !category
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Full name, registration number, course, department, academic year, semester and category are required.'
            });
        }

        /* ========================================================
           SEMESTER VALIDATION
        ======================================================== */

        if (
            Number(currentSemester) < 1 ||
            !Number.isInteger(
                Number(currentSemester)
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Current semester must be a valid number.'
            });
        }

        /* ========================================================
           PREVIOUS PERCENTAGE VALIDATION
        ======================================================== */

        if (
            previousPercentage !== undefined &&
            previousPercentage !== null &&
            previousPercentage !== '' &&
            (
                Number(previousPercentage) < 0 ||
                Number(previousPercentage) > 100
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Previous percentage must be between 0 and 100.'
            });
        }

        /* ========================================================
           FAMILY INCOME VALIDATION
        ======================================================== */

        if (
            familyIncome !== undefined &&
            familyIncome !== null &&
            familyIncome !== '' &&
            Number(familyIncome) < 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Family income cannot be negative.'
            });
        }

        /* ========================================================
           CHECK EXISTING PROFILE
        ======================================================== */

        const existingProfile =
            await StudentProfile.findOne({
                user: req.user.id
            });

        /* ========================================================
           PREPARE PROFILE DATA
        ======================================================== */

        const profileData = {
            user: req.user.id,

            fullName:
                fullName.trim(),

            registrationNumber:
                registrationNumber.trim(),

            course:
                course.trim(),

            department:
                department.trim(),

            academicYear:
                academicYear.trim(),

            currentSemester:
                Number(currentSemester),

            category:
                category.trim(),

            gender:
                gender
                    ? gender.trim()
                    : '',

            dateOfBirth:
                dateOfBirth
                    ? new Date(dateOfBirth)
                    : null,

            mobile:
                mobile
                    ? mobile.trim()
                    : '',

            address:
                address
                    ? address.trim()
                    : '',

            state:
                state
                    ? state.trim()
                    : '',

            familyIncome:
                familyIncome === undefined ||
                familyIncome === null ||
                familyIncome === ''
                    ? null
                    : Number(familyIncome),

            previousPercentage:
                previousPercentage === undefined ||
                previousPercentage === null ||
                previousPercentage === ''
                    ? null
                    : Number(previousPercentage),

            previousQualification:
                previousQualification
                    ? previousQualification.trim()
                    : '',

            bankAccountNumber:
                bankAccountNumber
                    ? bankAccountNumber.trim()
                    : '',

            bankName:
                bankName
                    ? bankName.trim()
                    : '',

            ifscCode:
                ifscCode
                    ? ifscCode.trim().toUpperCase()
                    : '',

            profileCompleted: true
        };

        /* ========================================================
           UPDATE EXISTING PROFILE
        ======================================================== */

        if (existingProfile) {
            const profile =
                await StudentProfile.findOneAndUpdate(
                    {
                        user: req.user.id
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
           CHECK REGISTRATION NUMBER
        ======================================================== */

        const registrationExists =
            await StudentProfile.findOne({
                registrationNumber:
                    registrationNumber.trim()
            });

        if (registrationExists) {
            return res.status(409).json({
                success: false,
                message:
                    'This registration number is already associated with another student.'
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

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message:
                    'This registration number is already in use.'
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

const getMyProfile = async (req, res) => {
    try {
        const profile =
            await StudentProfile.findOne({
                user: req.user.id
            }).populate(
                'user',
                'name email mobile role'
            );

        /*
           IMPORTANT:

           A student who has never created a profile is NOT
           considered an error.

           Return HTTP 200 with profile: null.

           This allows the frontend to display the empty
           profile form without producing a 404 error.
        */

        if (!profile) {
            return res.status(200).json({
                success: true,
                profile: null,
                profileCompleted: false,
                message:
                    'Student profile has not been created yet.'
            });
        }

        return res.status(200).json({
            success: true,
            profile,
            profileCompleted:
                profile.profileCompleted === true
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