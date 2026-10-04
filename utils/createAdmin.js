const dns = require('dns');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

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
    require('../models/User');


/* ============================================================
   ADMIN DETAILS
============================================================ */

const ADMIN_NAME =
    'University Administrator';

const ADMIN_EMAIL =
    'admin@university.edu';

const ADMIN_PASSWORD =
    'Admin@12345';


/* ============================================================
   CREATE / RESET ADMIN
============================================================ */

const createAdmin = async () => {

    try {

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


        /* --------------------------------------------------------
           CREATE ADMIN IF IT DOES NOT EXIST
        -------------------------------------------------------- */

        if (!admin) {

            admin =
                await User.create({
                    name:
                        ADMIN_NAME,

                    email:
                        ADMIN_EMAIL,

                    password:
                        hashedPassword,

                    role:
                        'admin',

                    mobile:
                        '',

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