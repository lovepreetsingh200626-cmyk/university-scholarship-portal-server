const Scholarship = require('../models/Scholarship');

/* ============================================================
   CREATE SCHOLARSHIP
============================================================ */

const createScholarship = async (req, res) => {
    try {
        const {
            name,
            description,
            academicYear,
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

        /* ========================================================
           REQUIRED FIELD VALIDATION
        ======================================================== */

        if (
            !name ||
            !description ||
            !academicYear ||
            scholarshipAmount === undefined ||
            !applicationStartDate ||
            !applicationEndDate
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Name, description, academic year, scholarship amount, application dates are required.'
            });
        }

        /* ========================================================
           DATE VALIDATION
        ======================================================== */

        const startDate = new Date(applicationStartDate);
        const endDate = new Date(applicationEndDate);

        if (
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid application start or end date.'
            });
        }

        if (endDate <= startDate) {
            return res.status(400).json({
                success: false,
                message:
                    'Application end date must be after the start date.'
            });
        }

        /* ========================================================
           SCHOLARSHIP AMOUNT VALIDATION
        ======================================================== */

        if (Number(scholarshipAmount) < 0) {
            return res.status(400).json({
                success: false,
                message: 'Scholarship amount cannot be negative.'
            });
        }

        /* ========================================================
           CREATE SCHOLARSHIP
        ======================================================== */

        const scholarship = await Scholarship.create({
            name: name.trim(),
            description: description.trim(),
            academicYear: academicYear.trim(),

            eligibleCourses: Array.isArray(eligibleCourses)
                ? eligibleCourses
                : [],

            eligibleDepartments: Array.isArray(eligibleDepartments)
                ? eligibleDepartments
                : [],

            eligibleCategories: Array.isArray(eligibleCategories)
                ? eligibleCategories
                : [],

            minimumPercentage:
                minimumPercentage === undefined
                    ? 0
                    : Number(minimumPercentage),

            maximumFamilyIncome:
                maximumFamilyIncome === undefined ||
                maximumFamilyIncome === ''
                    ? null
                    : Number(maximumFamilyIncome),

            scholarshipAmount: Number(scholarshipAmount),

            requiredDocuments: Array.isArray(requiredDocuments)
                ? requiredDocuments
                : [],

            applicationStartDate: startDate,
            applicationEndDate: endDate,

            instructions: instructions
                ? instructions.trim()
                : '',

            status: status || 'DRAFT',

            createdBy: req.user.id
        });

        return res.status(201).json({
            success: true,
            message: 'Scholarship created successfully.',
            scholarship
        });

    } catch (error) {
        console.error('Create scholarship error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to create scholarship.'
        });
    }
};

/* ============================================================
   GET ALL SCHOLARSHIPS
============================================================ */

const getAllScholarships = async (req, res) => {
    try {
        const scholarships = await Scholarship.find()
            .populate('createdBy', 'name email')
            .sort({
                createdAt: -1
            });

        return res.status(200).json({
            success: true,
            count: scholarships.length,
            scholarships
        });

    } catch (error) {
        console.error('Get scholarships error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to fetch scholarships.'
        });
    }
};

/* ============================================================
   GET SINGLE SCHOLARSHIP
============================================================ */

const getScholarshipById = async (req, res) => {
    try {
        const scholarship = await Scholarship.findById(
            req.params.id
        ).populate('createdBy', 'name email');

        if (!scholarship) {
            return res.status(404).json({
                success: false,
                message: 'Scholarship not found.'
            });
        }

        return res.status(200).json({
            success: true,
            scholarship
        });

    } catch (error) {
        console.error('Get scholarship error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to fetch scholarship.'
        });
    }
};

/* ============================================================
   UPDATE SCHOLARSHIP
============================================================ */

const updateScholarship = async (req, res) => {
    try {
        const scholarship = await Scholarship.findById(
            req.params.id
        );

        if (!scholarship) {
            return res.status(404).json({
                success: false,
                message: 'Scholarship not found.'
            });
        }

        const allowedFields = [
            'name',
            'description',
            'academicYear',
            'eligibleCourses',
            'eligibleDepartments',
            'eligibleCategories',
            'minimumPercentage',
            'maximumFamilyIncome',
            'scholarshipAmount',
            'requiredDocuments',
            'applicationStartDate',
            'applicationEndDate',
            'instructions',
            'status'
        ];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                scholarship[field] = req.body[field];
            }
        });

        /* ========================================================
           DATE VALIDATION
        ======================================================== */

        if (
            req.body.applicationStartDate !== undefined ||
            req.body.applicationEndDate !== undefined
        ) {
            const startDate = new Date(
                scholarship.applicationStartDate
            );

            const endDate = new Date(
                scholarship.applicationEndDate
            );

            if (
                Number.isNaN(startDate.getTime()) ||
                Number.isNaN(endDate.getTime())
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid application start or end date.'
                });
            }

            if (endDate <= startDate) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Application end date must be after the start date.'
                });
            }
        }

        await scholarship.save();

        return res.status(200).json({
            success: true,
            message: 'Scholarship updated successfully.',
            scholarship
        });

    } catch (error) {
        console.error('Update scholarship error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to update scholarship.'
        });
    }
};

/* ============================================================
   DELETE SCHOLARSHIP
============================================================ */

const deleteScholarship = async (req, res) => {
    try {
        const scholarship = await Scholarship.findById(
            req.params.id
        );

        if (!scholarship) {
            return res.status(404).json({
                success: false,
                message: 'Scholarship not found.'
            });
        }

        await scholarship.deleteOne();

        return res.status(200).json({
            success: true,
            message: 'Scholarship deleted successfully.'
        });

    } catch (error) {
        console.error('Delete scholarship error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to delete scholarship.'
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