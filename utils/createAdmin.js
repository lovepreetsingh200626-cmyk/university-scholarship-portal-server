const dns = require('dns');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

dotenv.config();

/* ============================================================
   DNS CONFIGURATION
============================================================ */

dns.setServers([
    '1.1.1.1',
    '8.8.8.8',
    '8.8.4.4'
]);


/* ============================================================
   DATABASE
============================================================ */

const connectDB =
    require('../config/db');


/* ============================================================
   USER MODEL
============================================================ */

const User =
    require('../models/user');


/* ============================================================
   ADMIN DETAILS
============================================================ */

const ADMIN_NAME = process.env.BOOTSTRAP_ADMIN_NAME;

const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();

const ADMIN_MOBILE = process.env.BOOTSTRAP_ADMIN_MOBILE;
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;


/* ============================================================
   CREATE / RESET ADMIN
============================================================ */

const createAdmin = async () => {

    try {

        if (!ADMIN_NAME || !ADMIN_EMAIL || !/^\d{10}$/.test(ADMIN_MOBILE || '') || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
            throw new Error('Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_MOBILE and a 12+ character BOOTSTRAP_ADMIN_PASSWORD in the server environment.');
        }

        /* --------------------------------------------------------
           CONNECT TO MONGODB
        -------------------------------------------------------- */

        await connectDB();

        console.log('');
        console.log(
            'MongoDB connection successful.'
        );


        /* --------------------------------------------------------
           HASH PASSWORD
        -------------------------------------------------------- */

        const hashedPassword =
            await bcrypt.hash(
                ADMIN_PASSWORD,
                10
            );


        /* --------------------------------------------------------
           FIND ADMIN ACCOUNT
        -------------------------------------------------------- */

        let admin =
            await User.findOne({
                email: ADMIN_EMAIL
            });

        if (admin) {
            throw new Error('An account already exists for this bootstrap email. The bootstrap command will not reset existing credentials.');
        }


        /* --------------------------------------------------------
           CREATE ADMIN IF IT DOES NOT EXIST
        -------------------------------------------------------- */

        if (!admin) {

                admin =
                    await User.create({
                    name:
                        ADMIN_NAME,

                    adminId:
                        `ADM${crypto.randomBytes(5).toString('hex').toUpperCase()}`,

                    email:
                        ADMIN_EMAIL,

                    password:
                        hashedPassword,

                    role:
                        'admin',

                    mobile:
                        ADMIN_MOBILE,

                    isActive:
                        true
                });

            console.log('');
            console.log(
                'New administrator account created.'
            );

        } else {

            /* ----------------------------------------------------
               EXISTING ACCOUNT
            ---------------------------------------------------- */

            admin.name =
                ADMIN_NAME;

            admin.password =
                hashedPassword;

            admin.role =
                'admin';

            admin.mobile =
                '';

            admin.isActive =
                true;

            await admin.save();

            console.log('');
            console.log(
                'Existing administrator account updated.'
            );
        }


        /* --------------------------------------------------------
           VERIFY SAVED ACCOUNT
        -------------------------------------------------------- */

        const savedAdmin =
            await User.findOne({
                email: ADMIN_EMAIL
            }).select(
                '+password'
            );


        if (!savedAdmin) {
            throw new Error(
                'Administrator account could not be verified after saving.'
            );
        }


        const passwordMatches =
            await bcrypt.compare(
                ADMIN_PASSWORD,
                savedAdmin.password
            );


        if (!passwordMatches) {
            throw new Error(
                'Administrator password verification failed after saving.'
            );
        }


        if (
            savedAdmin.role !==
            'admin'
        ) {
            throw new Error(
                'Administrator role verification failed.'
            );
        }


        if (
            savedAdmin.isActive !==
            true
        ) {
            throw new Error(
                'Administrator account is not active.'
            );
        }


        /* --------------------------------------------------------
           SUCCESS
        -------------------------------------------------------- */

        console.log('');

        console.log(
            '=============================================='
        );

        console.log(
            ' ADMIN ACCOUNT READY'
        );

        console.log(
            '=============================================='
        );

        console.log(
            `Name: ${savedAdmin.name}`
        );

        console.log(
            `Email: ${savedAdmin.email}`
        );

        console.log(
            `Admin ID: ${savedAdmin.adminId}`
        );

        console.log(
            `Role: ${savedAdmin.role}`
        );

        console.log(
            `Active: ${savedAdmin.isActive}`
        );

        console.log(
            'Password verification: SUCCESS'
        );

        console.log(
            '=============================================='
        );

        console.log('');

        await User.db.close();

        process.exit(0);

    } catch (error) {

        console.error('');

        console.error(
            '=============================================='
        );

        console.error(
            ' ADMIN ACCOUNT SETUP FAILED'
        );

        console.error(
            '=============================================='
        );

        console.error(
            error.message
        );

        console.error(
            '=============================================='
        );

        console.error('');

        try {

            if (
                User &&
                User.db
            ) {
                await User.db.close();
            }

        } catch (disconnectError) {
            // Ignore disconnect errors.
        }

        process.exit(1);
    }
};


/* ============================================================
   START
============================================================ */

createAdmin();
