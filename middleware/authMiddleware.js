const jwt = require('jsonwebtoken');

/* ============================================================
   VERIFY JWT TOKEN
============================================================ */

const protect = (req, res, next) => {
    try {
        /* --------------------------------------------------------
           CHECK JWT SECRET
        -------------------------------------------------------- */

        if (!process.env.JWT_SECRET) {
            console.error(
                'Authentication error: JWT_SECRET is not configured.'
            );

            return res.status(500).json({
                success: false,
                message:
                    'Authentication service is not configured properly.'
            });
        }

        /* --------------------------------------------------------
           READ AUTHORIZATION HEADER
        -------------------------------------------------------- */

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is required.'
            });
        }

        /* --------------------------------------------------------
           CHECK BEARER FORMAT
        -------------------------------------------------------- */

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication format.'
            });
        }

        /* --------------------------------------------------------
           EXTRACT TOKEN
        -------------------------------------------------------- */

        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is missing.'
            });
        }

        /* --------------------------------------------------------
           VERIFY JWT
        -------------------------------------------------------- */

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ['HS256']
            }
        );

        /* --------------------------------------------------------
           VALIDATE JWT PAYLOAD
        -------------------------------------------------------- */

        if (
            !decoded ||
            !decoded.id ||
            !decoded.role
        ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token.'
            });
        }

        /* --------------------------------------------------------
           VALIDATE ROLE
        -------------------------------------------------------- */

        if (
            decoded.role !== 'student' &&
            decoded.role !== 'admin'
        ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication role.'
            });
        }

        const isPasswordChangeRequest =
            req.method === 'POST' &&
            req.originalUrl.split('?')[0].endsWith('/auth/change-password');

        if (
            decoded.role === 'student' &&
            decoded.mustChangePassword === true &&
            !isPasswordChangeRequest
        ) {
            return res.status(403).json({
                success: false,
                code: 'PASSWORD_CHANGE_REQUIRED',
                message: 'Change your initial password before continuing.'
            });
        }

        /* --------------------------------------------------------
           ATTACH AUTHENTICATED USER
        -------------------------------------------------------- */

        req.user = {
            id: decoded.id,
            role: decoded.role
        };

        next();

    } catch (error) {

        /* --------------------------------------------------------
           JWT ERRORS
        -------------------------------------------------------- */

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message:
                    'Your session has expired. Please login again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message:
                    'Invalid authentication token.'
            });
        }

        console.error(
            'Authentication error:',
            error.message
        );

        return res.status(401).json({
            success: false,
            message:
                'Authentication failed. Please login again.'
        });
    }
};


/* ============================================================
   ADMIN ONLY
============================================================ */

const adminOnly = (req, res, next) => {

    /* --------------------------------------------------------
       AUTHENTICATION CHECK
    -------------------------------------------------------- */

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    /* --------------------------------------------------------
       ADMIN ROLE CHECK
    -------------------------------------------------------- */

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access is required.'
        });
    }

    next();
};


/* ============================================================
   EXPORT
============================================================ */

module.exports = {
    protect,
    adminOnly
};
