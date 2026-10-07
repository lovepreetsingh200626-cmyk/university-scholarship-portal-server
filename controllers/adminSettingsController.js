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

const MAX_ADMIN_SIGNATURE_SIZE = 500 * 1024;
const jpegDimensions = (image) => {
    let offset = 2;
    while (offset + 4 < image.length) {
        if (image[offset] !== 0xff) { offset += 1; continue; }
        while (image[offset] === 0xff) offset += 1;
        const marker = image[offset++];
        if (marker === 0xd9 || marker === 0xda) break;
        if ([0xd8, 0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7].includes(marker)) continue;
        if (offset + 2 > image.length) break;
        const segmentLength = image.readUInt16BE(offset);
        if (segmentLength < 2 || offset + segmentLength > image.length) break;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && segmentLength >= 7) {
            return { height: image.readUInt16BE(offset + 3), width: image.readUInt16BE(offset + 5) };
        }
        offset += segmentLength;
    }
    return null;
};

const getAdminSignature = async (req, res) => {
    try {
        const admin = await User.findOne({ role: 'admin', isActive: true, adminSignatureActive: true, adminSignatureData: { $exists: true } })
            .select('name +adminSignatureData +adminSignatureType')
            .sort({ createdAt: 1 })
            .lean();
        const mimeType = admin?.adminSignatureType;
        return res.json({
            success: true,
            signature: admin?.adminSignatureData && ['image/png', 'image/jpeg'].includes(mimeType)
                ? { name: admin.name, dataUrl: 'data:' + mimeType + ';base64,' + Buffer.from(admin.adminSignatureData).toString('base64') }
                : null
        });
    } catch (error) {
        console.error('Get admin signature error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to load the portal admin signature.' });
    }
};

const saveAdminSignature = async (req, res) => {
    const dataUrl = req.body?.dataUrl;
    const match = typeof dataUrl === 'string'
        ? /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
        : null;
    if (!match) return res.status(400).json({ success: false, message: 'Upload a PNG or JPEG signature image.' });
    const mimeType = match[1];
    const encoded = match[2];
    if (encoded.length > 700000 || encoded.length % 4 !== 0) {
        return res.status(400).json({ success: false, message: 'The signature image must be 500 KB or smaller.' });
    }
    const image = Buffer.from(encoded, 'base64');
    if (image.length < 100 || image.length > MAX_ADMIN_SIGNATURE_SIZE) {
        return res.status(400).json({ success: false, message: 'The signature image must be valid and no larger than 500 KB.' });
    }
    let dimensions = null;
    if (mimeType === 'image/png') {
        const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
        if (image.length < 29 || !image.subarray(0, 8).equals(pngSignature) || image.readUInt32BE(8) !== 13 || image.toString('ascii', 12, 16) !== 'IHDR') {
            return res.status(400).json({ success: false, message: 'The uploaded file is not a valid PNG image.' });
        }
        dimensions = { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
        if (image[24] !== 8 || ![0, 2, 3, 4, 6].includes(image[25]) || image[28] !== 0) {
            return res.status(400).json({ success: false, message: 'Use a non-interlaced, 8-bit PNG image.' });
        }
    } else {
        if (image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) {
            return res.status(400).json({ success: false, message: 'The uploaded file is not a valid JPEG image.' });
        }
        dimensions = jpegDimensions(image);
        if (!dimensions) return res.status(400).json({ success: false, message: 'The uploaded JPEG image could not be read.' });
    }
    if (dimensions.width < 100 || dimensions.height < 20 || dimensions.width > 2400 || dimensions.height > 800) {
        return res.status(400).json({ success: false, message: 'Use an image between 100 and 2400 px wide and 20 and 800 px high.' });
    }
    try {
        const admin = await User.findOne({ _id: req.user.id, role: 'admin', isActive: true });
        if (!admin) return res.status(404).json({ success: false, message: 'Admin account not found.' });
        await User.updateMany({ role: 'admin' }, { $set: { adminSignatureActive: false } });
        admin.adminSignatureData = image;
        admin.adminSignatureType = mimeType;
        admin.adminSignatureActive = true;
        await admin.save();
        return res.json({
            success: true,
            message: 'Portal administrator signature saved. It will appear on generated scholarship and Freeship PDFs.',
            signature: { name: admin.name, dataUrl }
        });
    } catch (error) {
        console.error('Save admin signature error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to save the portal admin signature.' });
    }
};
const removeAdminSignature = async (req, res) => {
    try {
        await User.updateMany({ role: 'admin' }, { $set: { adminSignatureActive: false } });
        return res.json({ success: true, message: 'Portal administrator signature removed from generated PDFs.' });
    } catch (error) {
        console.error('Remove admin signature error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to remove the portal admin signature.' });
    }
};
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
    getAdminSignature,
    saveAdminSignature,
    removeAdminSignature,

    changeAdminPassword,
    createAdminAccount

};
