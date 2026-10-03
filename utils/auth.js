const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/* ============================================================
   PASSWORD HASHING
============================================================ */

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

/* ============================================================
   PASSWORD CHECK
============================================================ */

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

/* ============================================================
   CREATE JWT TOKEN
============================================================ */

const createToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '7d'
        }
    );
};

module.exports = {
    hashPassword,
    comparePassword,
    createToken
};