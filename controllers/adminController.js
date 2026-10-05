const User = require('../models/User');

const {
    hashPassword,
    createToken
} = require('../utils/auth');


/* ============================================================
   CREATE ADMIN
   INTERNAL / SETUP USE
============================================================ */

const createAdmin = async (
    req,
    res
) => {

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

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            typeof email !== 'string' ||
            !email.trim() ||
            typeof password !== 'string' ||
            !password
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Name, email and password are required.'
            });
        }


        /* ========================================================
           NORMALIZE INPUT
        ======================================================== */

        const normalizedName =
            name.trim();

        const normalizedEmail =
            email.trim().toLowerCase();


        /* ========================================================
           NAME VALIDATION
        ======================================================== */

        if (
            normalizedName.length < 2 ||
            normalizedName.length > 100
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Name must be between 2 and 100 characters.'
            });
        }


        /* ========================================================
           EMAIL VALIDATION
        ======================================================== */

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
            !emailPattern.test(
                normalizedEmail
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Please provide a valid email address.'
            });
        }


        if (
            normalizedEmail.length > 254
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Email address is too long.'
            });
        }


        /* ========================================================
           PASSWORD VALIDATION
        ======================================================== */

        if (
            password.length < 8
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Password must be at least 8 characters long.'
            });
        }


        if (
            password.length > 200
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Password is too long.'
            });
        }


        /* ========================================================
           MOBILE VALIDATION
        ======================================================== */

        let normalizedMobile = '';


        if (
            mobile !== undefined &&
            mobile !== null &&
            mobile !== ''
        ) {

            if (
                typeof mobile !== 'string'
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Mobile number must be a valid 10-digit number.'
                });
            }


            normalizedMobile =
                mobile.trim();


            if (
                !/^\d{10}$/.test(
                    normalizedMobile
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Mobile number must be a valid 10-digit number.'
                });
            }
        }


        /* ========================================================
           CHECK EXISTING USER
        ======================================================== */

        const existingUser =
            await User.findOne({
                email:
                    normalizedEmail
            });


        if (
            existingUser
        ) {

            return res.status(409).json({
                success: false,
                message:
                    'An account with this email already exists.'
            });
        }


        /* ========================================================
           HASH PASSWORD
        ======================================================== */

        const hashedPassword =
            await hashPassword(
                password
            );


        /* ========================================================
           CREATE ADMIN
        ======================================================== */

        const admin =
            await User.create({

                name:
                    normalizedName,

                email:
                    normalizedEmail,

                password:
                    hashedPassword,

                mobile:
                    normalizedMobile,

                role:
                    'admin',

                isActive:
                    true
            });


        /* ========================================================
           CREATE JWT
        ======================================================== */

        const token =
            createToken(
                admin
            );


        /* ========================================================
           RESPONSE
        ======================================================== */

        return res.status(201).json({

            success: true,

            message:
                'Admin account created successfully.',

            token,

            user: {
                id:
                    admin._id,

                name:
                    admin.name,

                email:
                    admin.email,

                mobile:
                    admin.mobile,

                role:
                    admin.role
            }
        });

    } catch (error) {

        console.error(
            'Admin creation error:',
            error
        );


        /* ========================================================
           DUPLICATE EMAIL RACE CONDITION
        ======================================================== */

        if (
            error &&
            error.code === 11000
        ) {

            return res.status(409).json({
                success: false,
                message:
                    'An account with this email already exists.'
            });
        }


        /* ========================================================
           SERVER ERROR
        ======================================================== */

        return res.status(500).json({
            success: false,
            message:
                'Unable to create admin account.'
        });
    }
};


/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
    createAdmin
};