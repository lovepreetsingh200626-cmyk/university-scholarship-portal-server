const User = require('../models/User');

const {
    hashPassword,
    createToken
} = require('../utils/auth');

/* ============================================================
   CREATE ADMIN
   INTERNAL / SETUP USE
============================================================ */

const createAdmin = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            mobile
        } = req.body;

        /* ========================================================
           REQUIRED FIELDS
        ======================================================== */

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message:
                    'Name, email and password are required.'
            });
        }

        const normalizedEmail = email
            .trim()
            .toLowerCase();

        /* ========================================================
           CHECK EXISTING USER
        ======================================================== */

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message:
                    'An account with this email already exists.'
            });
        }

        /* ========================================================
           HASH PASSWORD
        ======================================================== */

        const hashedPassword = await hashPassword(
            password
        );

        /* ========================================================
           CREATE ADMIN
        ======================================================== */

        const admin = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            mobile: mobile
                ? mobile.trim()
                : '',
            role: 'admin',
            isActive: true
        });

        /* ========================================================
           CREATE JWT
        ======================================================== */

        const token = createToken(admin);

        return res.status(201).json({
            success: true,
            message: 'Admin account created successfully.',
            token,
            user: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                mobile: admin.mobile,
                role: admin.role
            }
        });

    } catch (error) {
        console.error(
            'Admin creation error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to create admin account.'
        });
    }
};

module.exports = {
    createAdmin
};