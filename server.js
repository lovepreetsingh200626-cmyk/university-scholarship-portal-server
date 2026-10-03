const express = require('express');
const cors = require('cors');
const dns = require('dns');
require('dotenv').config();

const connectDB = require('./config/db');

/* ============================================================
   ROUTES
============================================================ */

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
   CORS
============================================================ */

const allowedOrigins = [
    'https://scholarship-frontend-theta.vercel.app',
    'http://localhost:5173'
];

app.use(
    cors({
        origin: (origin, callback) => {

            /*
               Allow requests without an Origin header.
               Useful for server-to-server requests
               and health checks.
            */
            if (!origin) {
                return callback(null, true);
            }

            if (
                allowedOrigins.includes(origin)
            ) {
                return callback(null, true);
            }

            return callback(
                new Error(
                    'Not allowed by CORS'
                )
            );
        },

        credentials: true,

        methods: [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS'
        ],

        allowedHeaders: [
            'Content-Type',
            'Authorization'
        ]
    })
);

/* ============================================================
   BODY PARSERS
============================================================ */

app.use(
    express.json({
        limit: '10mb'
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: '10mb'
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
            environment:
                process.env.NODE_ENV ||
                'development'
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
                `Route ${req.method} ${req.originalUrl} not found.`
        });
    }
);

/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */

app.use(
    (error, req, res, next) => {

        console.error('');
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
        console.error('');

        if (
            error.message ===
            'Not allowed by CORS'
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'Request blocked by CORS policy.'
            });
        }

        return res.status(
            error.statusCode || 500
        ).json({
            success: false,
            message:
                error.message ||
                'Internal server error.'
        });
    }
);

/* ============================================================
   SERVER START
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
                    ` Server running on port: ${PORT}`
                );
                console.log(
                    ` Environment: ${
                        process.env.NODE_ENV ||
                        'development'
                    }`
                );
                console.log(
                    ' MongoDB: Connected'
                );
                console.log(
                    '=============================================='
                );
                console.log('');
            }
        );

    } catch (error) {

        console.error('');
        console.error(
            '=============================================='
        );
        console.error(
            ' SERVER STARTUP FAILED'
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

        process.exit(1);
    }
};

startServer();

module.exports = app;