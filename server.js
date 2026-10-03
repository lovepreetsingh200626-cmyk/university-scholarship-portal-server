const express = require('express');
const cors = require('cors');
const dns = require('dns');

require('dotenv').config();

const connectDB = require('./config/db');

const authRoutes =
    require('./routes/authRoutes');

const scholarshipRoutes =
    require('./routes/scholarshipRoutes');

const adminRoutes =
    require('./routes/adminRoutes');

const adminApplicationRoutes =
    require('./routes/adminApplicationRoutes');

const adminStudentRoutes =
    require('./routes/adminStudentRoutes');

const adminSettingsRoutes =
    require('./routes/adminSettingsRoutes');

const studentProfileRoutes =
    require('./routes/studentProfileRoutes');

const eligibilityRoutes =
    require('./routes/eligibilityRoutes');

const applicationRoutes =
    require('./routes/applicationRoutes');


/* ============================================================
   DNS CONFIGURATION
============================================================ */

dns.setServers([
    '1.1.1.1',
    '8.8.8.8',
    '8.8.4.4'
]);


/* ============================================================
   EXPRESS APP
============================================================ */

const app = express();


/* ============================================================
   MIDDLEWARE
============================================================ */

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


/* ============================================================
   STATIC UPLOADS
============================================================ */

app.use(
    '/uploads',
    express.static('uploads')
);


/* ============================================================
   API ROUTES
============================================================ */

app.use(
    '/api/auth',
    authRoutes
);

app.use(
    '/api/admin',
    adminRoutes
);

app.use(
    '/api/admin/applications',
    adminApplicationRoutes
);

app.use(
    '/api/admin/students',
    adminStudentRoutes
);

app.use(
    '/api/admin/settings',
    adminSettingsRoutes
);

app.use(
    '/api/scholarships',
    scholarshipRoutes
);

app.use(
    '/api/student-profile',
    studentProfileRoutes
);

app.use(
    '/api/eligibility',
    eligibilityRoutes
);

app.use(
    '/api/applications',
    applicationRoutes
);


/* ============================================================
   HEALTH CHECK
============================================================ */

app.get(
    '/api/health',
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                'University Scholarship Portal API is running.',

            timestamp:
                new Date().toISOString()

        });

    }
);


/* ============================================================
   ROOT ROUTE
============================================================ */

app.get(
    '/',
    (req, res) => {

        res.status(200).json({

            success: true,

            message:
                'University Scholarship Portal Backend'

        });

    }
);


/* ============================================================
   404 HANDLER
============================================================ */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                `Route not found: ${req.method} ${req.originalUrl}`

        });

    }
);


/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            '=============================================='
        );

        console.error(
            ' GLOBAL SERVER ERROR'
        );

        console.error(
            '=============================================='
        );

        console.error(
            error
        );

        console.error(
            '=============================================='
        );


        res.status(
            error.status || 500
        ).json({

            success: false,

            message:
                error.message ||
                'Internal server error.'

        });

    }
);


/* ============================================================
   START SERVER
============================================================ */

const PORT =
    process.env.PORT || 5000;


const startServer = async () => {

    try {

        await connectDB();


        app.listen(
            PORT,
            () => {

                console.log('');
                console.log(
                    '=============================================='
                );

                console.log(
                    ' UNIVERSITY SCHOLARSHIP PORTAL'
                );

                console.log(
                    '=============================================='
                );

                console.log(
                    ` Server: http://localhost:${PORT}`
                );

                console.log(
                    ` API: http://localhost:${PORT}/api`
                );

                console.log(
                    ` Health: http://localhost:${PORT}/api/health`
                );

                console.log(
                    '=============================================='
                );

                console.log('');

            }
        );


    } catch (error) {

        console.error(
            'Unable to start server:',
            error.message
        );

        process.exit(1);

    }

};


startServer();