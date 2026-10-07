const express = require('express');
const cors = require('cors');
const dns = require('dns');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

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

const adminDeletionRoutes =
    require('./routes/adminDeletionRoutes');

const studentProfileRoutes =
    require('./routes/studentProfileRoutes');

const eligibilityRoutes =
    require('./routes/eligibilityRoutes');

const applicationRoutes =
    require('./routes/applicationRoutes');

const freeshipCardRoutes =
    require('./routes/freeshipCardRoutes');

const institutionRoutes =
    require('./routes/institutionRoutes');

const villageRoutes =
    require('./routes/villageRoutes');

const dntRoutes =
    require('./routes/dntRoutes');


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
   TRUST PROXY
============================================================ */

app.set(
    'trust proxy',
    1
);


/* ============================================================
   SECURITY HEADERS
============================================================ */

app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: 'cross-origin'
        }
    })
);


/* ============================================================
   CORS CONFIGURATION
============================================================ */

const normalizeOrigin = (origin) => {
    if (
        typeof origin !== 'string'
    ) {
        return '';
    }

    return origin
        .trim()
        .replace(/\/+$/, '');
};


const configuredOrigins = (
    process.env.FRONTEND_URL ||
    ''
)
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);


const defaultDevelopmentOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173'
];


const productionOrigins = [
    'https://university-scholarship-portal.vercel.app'
];


const allowedOrigins = [
    ...new Set([
        ...defaultDevelopmentOrigins,
        ...configuredOrigins,
        ...productionOrigins
    ])
];


const corsOptions = {
    origin: (
        origin,
        callback
    ) => {

        /*
           Requests without an Origin header can occur
           from tools such as PowerShell, server-to-server
           requests, or health checks.
        */

        if (!origin) {
            return callback(
                null,
                true
            );
        }


        const normalizedOrigin =
            normalizeOrigin(origin);


        if (
            allowedOrigins.includes(
                normalizedOrigin
            )
        ) {
            return callback(
                null,
                true
            );
        }


        console.error(
            'CORS blocked origin:',
            origin
        );


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
    ],

    exposedHeaders: [
        'Content-Length'
    ],

    optionsSuccessStatus: 204
};


app.use(
    cors(corsOptions)
);


/* ============================================================
   REQUEST RATE LIMITING
============================================================ */

const generalLimiter =
    rateLimit({
        windowMs:
            15 * 60 * 1000,

        max: 300,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            success: false,
            message:
                'Too many requests from this IP. Please try again later.'
        }
    });


app.use(
    '/api',
    generalLimiter
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
   EXPRESS 5 COMPATIBLE MONGODB INPUT SANITIZATION
============================================================ */

const sanitizeMongoObject = (
    value
) => {

    if (
        !value ||
        typeof value !== 'object'
    ) {
        return value;
    }


    if (
        Array.isArray(value)
    ) {

        for (
            let index = 0;
            index < value.length;
            index++
        ) {

            if (
                value[index] &&
                typeof value[index] ===
                    'object'
            ) {
                sanitizeMongoObject(
                    value[index]
                );
            }
        }

        return value;
    }


    for (
        const key of Object.keys(value)
    ) {

        if (
            key.startsWith('$') ||
            key.includes('.')
        ) {
            delete value[key];
            continue;
        }


        const nestedValue =
            value[key];


        if (
            nestedValue &&
            typeof nestedValue ===
                'object'
        ) {
            sanitizeMongoObject(
                nestedValue
            );
        }
    }


    return value;
};


app.use(
    (req, res, next) => {

        try {

            if (
                req.body &&
                typeof req.body ===
                    'object'
            ) {
                sanitizeMongoObject(
                    req.body
                );
            }


            if (
                req.params &&
                typeof req.params ===
                    'object'
            ) {
                sanitizeMongoObject(
                    req.params
                );
            }


            if (
                req.query &&
                typeof req.query ===
                    'object'
            ) {
                sanitizeMongoObject(
                    req.query
                );
            }


            next();

        } catch (error) {

            next(error);
        }
    }
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
    '/api/admin/deletion',
    adminDeletionRoutes
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


app.use(
    '/api/freeship-cards',
    freeshipCardRoutes
);

app.use(
    '/api/institutions',
    institutionRoutes
);

app.use(
    '/api/villages',
    villageRoutes
);

app.use(
    '/api/dnt',
    dntRoutes
);


/* ============================================================
   HEALTH CHECK
============================================================ */

app.get(
    '/api',
    (req, res) => {

        res.status(200).json({
            success: true,

            message:
                'University Scholarship Portal API is running.',

            healthCheck:
                '/api/health'
        });
    }
);

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
    (
        error,
        req,
        res,
        next
    ) => {

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


        if (
            error.statusCode === 429
        ) {
            return res.status(429).json({
                success: false,
                message:
                    'Too many requests. Please try again later.'
            });
        }


        return res.status(
            error.statusCode || 500
        ).json({
            success: false,

            message:
                process.env.NODE_ENV ===
                    'production'
                    ? 'Internal server error.'
                    : (
                        error.message ||
                        'Internal server error.'
                    )
        });
    }
);


/* ============================================================
   LOCAL SERVER START
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
                    ' Security: Helmet enabled'
                );

                console.log(
                    ' Security: Rate limiting enabled'
                );

                console.log(
                    ' Security: Custom MongoDB sanitization enabled'
                );

                console.log(
                    ' Security: CORS enabled'
                );

                console.log(
                    ' Storage: Cloudinary migration active'
                );

                console.log(
                    '=============================================='
                );

                console.log('');

                console.log(
                    'Allowed CORS origins:'
                );


                allowedOrigins.forEach(
                    (origin) => {

                        console.log(
                            ` - ${origin}`
                        );
                    }
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


/* ============================================================
   LOCAL DEVELOPMENT
============================================================ */

if (
    require.main === module
) {
    startServer();
}


/* ============================================================
   VERCEL SERVERLESS HANDLER
============================================================ */

module.exports = async (
    req,
    res
) => {

    try {

        await connectDB();

        return app(
            req,
            res
        );

    } catch (error) {

        console.error(
            'Vercel server initialization error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Database connection failed.'
        });
    }
};
