const jwt = require('jsonwebtoken');

/* ============================================================
   VERIFY JWT TOKEN
============================================================ */

const protect = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is required.'
            });
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication format.'
            });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is missing.'
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = {
            id: decoded.id,
            role: decoded.role
        };

        next();

    } catch (error) {
        console.error('Authentication error:', error.message);

        return res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token.'
        });
    }
};

/* ============================================================
   ADMIN ONLY
============================================================ */

const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access is required.'
        });
    }

    next();
};

module.exports = {
    protect,
    adminOnly
};