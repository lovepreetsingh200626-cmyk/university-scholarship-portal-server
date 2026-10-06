const User = require('../models/user');

const {
    hashPassword,
    comparePassword
} = require('../utils/auth');
const { ensureAdminId, generateAdminId } = require('../utils/adminIdentity');


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
                    'name email mobile adminId isActive createdAt updatedAt'
                );


        if (!admin) {

            return res.status(404).json({

                success: false,

                message:
                    'Admin account not found.'

            });

        }

        await ensureAdminId(admin);


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

            if (
                typeof name !== 'string'
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin name must be text.'

                });

            }


            const cleanName =
                name.trim();


            if (!cleanName) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin name cannot be empty.'

                });

            }


            if (
                cleanName.length < 2
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin name must contain at least 2 characters.'

                });

            }


            if (
                cleanName.length > 100
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin name cannot exceed 100 characters.'

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

            if (
                typeof email !== 'string'
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin email must be text.'

                });

            }


            const cleanEmail =
                email
                    .trim()
                    .toLowerCase();


            if (!cleanEmail) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin email cannot be empty.'

                });

            }


            if (
                cleanEmail.length > 254
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin email cannot exceed 254 characters.'

                });

            }


            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
                !emailPattern.test(
                    cleanEmail
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Please enter a valid admin email address.'

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

            if (
                typeof mobile !== 'string' &&
                typeof mobile !== 'number'
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin mobile number must be valid.'

                });

            }


            const cleanMobile =
                String(mobile).trim();


            if (
                cleanMobile &&
                !/^\d{10}$/.test(
                    cleanMobile
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Admin mobile number must contain exactly 10 digits.'

                });

            }


            admin.mobile =
                cleanMobile;

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


        if (
            error.code === 11000
        ) {

            return res.status(409).json({

                success: false,

                message:
                    'This email address is already in use.'

            });

        }


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
            typeof currentPassword !== 'string' ||
            typeof newPassword !== 'string' ||
            typeof confirmPassword !== 'string' ||
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


        if (
            newPassword.length > 200
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'New password cannot exceed 200 characters.'

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


const createAdminAccount = async (req, res) => {
    const { name, email, mobile, password } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanMobile = typeof mobile === 'string' ? mobile.trim() : '';
    if (cleanName.length < 2 || cleanName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
        return res.status(400).json({ success: false, message: 'Enter a valid administrator name and email address.' });
    }
    if (!/^\d{10}$/.test(cleanMobile)) {
        return res.status(400).json({ success: false, message: 'Administrator mobile number must contain exactly 10 digits.' });
    }
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
        return res.status(400).json({ success: false, message: 'Set an initial password between 12 and 128 characters.' });
    }
    try {
        let created;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const adminId = generateAdminId();
            try {
                created = await User.create({
                    name: cleanName,
                    email: cleanEmail,
                    mobile: cleanMobile,
                    adminId,
                    password: await hashPassword(password),
                    role: 'admin',
                    isActive: true
                });
                break;
            } catch (error) {
                if (error?.code === 11000 && error.keyPattern?.adminId) continue;
                if (error?.code === 11000) return res.status(409).json({ success: false, message: 'This email is already attached to an account.' });
                throw error;
            }
        }
        if (!created) throw new Error('Unable to generate a unique administrator ID.');
        return res.status(201).json({
            success: true,
            message: 'Administrator account created. Share the Admin ID and initial password securely with the new administrator.',
            admin: { id: created._id, name: created.name, email: created.email, mobile: created.mobile, adminId: created.adminId }
        });
    } catch (error) {
        console.error('Create admin account error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to create the administrator account.' });
    }
};

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {

    getAdminProfile,

    updateAdminProfile,

    changeAdminPassword,
    createAdminAccount

};
