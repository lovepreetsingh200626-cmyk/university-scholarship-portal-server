const User = require('../models/user');

const {
    hashPassword,
    comparePassword
} = require('../utils/auth');


/* ============================================================
   GET ADMIN PROFILE
============================================================ */

const getAdminProfile = async (
    req,
    res
) => {

    try {

        const admin =
            await User.findOne({
                _id: req.user.id,
                role: 'admin'
            })
                .select(
                    'name email mobile isActive createdAt updatedAt'
                )
                .lean();


        if (!admin) {

            return res.status(404).json({

                success: false,

                message:
                    'Admin account not found.'

            });

        }


        return res.status(200).json({

            success: true,

            admin

        });


    } catch (error) {

        console.error(
            'Get admin profile error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to fetch admin profile.'

        });

    }

};


/* ============================================================
   UPDATE ADMIN PROFILE
============================================================ */

const updateAdminProfile = async (
    req,
    res
) => {

    try {

        const {
            name,
            email,
            mobile
        } = req.body;


        const admin =
            await User.findOne({
                _id: req.user.id,
                role: 'admin'
            });


        if (!admin) {

            return res.status(404).json({

                success: false,

                message:
                    'Admin account not found.'

            });

        }


        /* ====================================================
           NAME
        ==================================================== */

        if (
            name !== undefined
        ) {

            const cleanName =
                String(name).trim();


            if (!cleanName) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin name cannot be empty.'

                });

            }


            admin.name =
                cleanName;

        }


        /* ====================================================
           EMAIL
        ==================================================== */

        if (
            email !== undefined
        ) {

            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            if (!cleanEmail) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin email cannot be empty.'

                });

            }


            const existingUser =
                await User.findOne({

                    email:
                        cleanEmail,

                    _id: {
                        $ne:
                            admin._id
                    }

                });


            if (existingUser) {

                return res.status(409).json({

                    success: false,

                    message:
                        'This email address is already in use.'

                });

            }


            admin.email =
                cleanEmail;

        }


        /* ====================================================
           MOBILE
        ==================================================== */

        if (
            mobile !== undefined
        ) {

            admin.mobile =
                String(mobile).trim();

        }


        await admin.save();


        const updatedAdmin =
            await User.findById(
                admin._id
            )
                .select(
                    'name email mobile isActive createdAt updatedAt'
                )
                .lean();


        return res.status(200).json({

            success: true,

            message:
                'Admin profile updated successfully.',

            admin:
                updatedAdmin

        });


    } catch (error) {

        console.error(
            'Update admin profile error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to update admin profile.'

        });

    }

};


/* ============================================================
   CHANGE ADMIN PASSWORD
============================================================ */

const changeAdminPassword = async (
    req,
    res
) => {

    try {

        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = req.body;


        /* ====================================================
           REQUIRED FIELDS
        ==================================================== */

        if (
            !currentPassword ||
            !newPassword ||
            !confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Current password, new password and confirm password are required.'

            });

        }


        /* ====================================================
           PASSWORD MATCH
        ==================================================== */

        if (
            newPassword !==
            confirmPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'New passwords do not match.'

            });

        }


        /* ====================================================
           PASSWORD LENGTH
        ==================================================== */

        if (
            newPassword.length < 8
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'New password must contain at least 8 characters.'

            });

        }


        /* ====================================================
           GET ADMIN
        ==================================================== */

        const admin =
            await User.findOne({
                _id: req.user.id,
                role: 'admin'
            });


        if (!admin) {

            return res.status(404).json({

                success: false,

                message:
                    'Admin account not found.'

            });

        }


        /* ====================================================
           VERIFY CURRENT PASSWORD
        ==================================================== */

        const passwordMatches =
            await comparePassword(
                currentPassword,
                admin.password
            );


        if (!passwordMatches) {

            return res.status(401).json({

                success: false,

                message:
                    'Current password is incorrect.'

            });

        }


        /* ====================================================
           PREVENT SAME PASSWORD
        ==================================================== */

        const samePassword =
            await comparePassword(
                newPassword,
                admin.password
            );


        if (samePassword) {

            return res.status(400).json({

                success: false,

                message:
                    'New password must be different from the current password.'

            });

        }


        /* ====================================================
           HASH NEW PASSWORD
        ==================================================== */

        admin.password =
            await hashPassword(
                newPassword
            );


        await admin.save();


        return res.status(200).json({

            success: true,

            message:
                'Admin password changed successfully.'

        });


    } catch (error) {

        console.error(
            'Change admin password error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Unable to change admin password.'

        });

    }

};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {

    getAdminProfile,

    updateAdminProfile,

    changeAdminPassword

};