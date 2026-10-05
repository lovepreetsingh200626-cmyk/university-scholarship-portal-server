const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


/* ============================================================
   PASSWORD HASHING
============================================================ */

const hashPassword = async (password) => {
    return await bcrypt.hash(
        password,
        10
    );
};


/* ============================================================
   PASSWORD CHECK
============================================================ */

const comparePassword = async (
    password,
    hashedPassword
) => {
    return await bcrypt.compare(
        password,
        hashedPassword
    );
};


/* ============================================================
   CREATE JWT TOKEN
============================================================ */

const createToken = (user) => {

    if (!process.env.JWT_SECRET) {
        throw new Error(
            'JWT_SECRET is not configured.'
        );
    }


    if (
        !user ||
        !user._id ||
        !user.role
    ) {
        throw new Error(
            'Invalid user data for token creation.'
        );
    }


    return jwt.sign(
        {
            id: user._id,
            role: user.role,
            mustChangePassword: Boolean(user.mustChangePassword)
        },

        process.env.JWT_SECRET,

        {
            expiresIn: '7d',
            algorithm: 'HS256'
        }
    );
};


/* ============================================================
   EXPORT
============================================================ */

module.exports = {
    hashPassword,
    comparePassword,
    createToken
};
