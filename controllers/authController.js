const User = require('../models/User');

const {
    hashPassword,
    comparePassword,
    createToken
} = require('../utils/auth');

/* ============================================================
   REGISTER STUDENT
============================================================ */

const registerStudent = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            mobile
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists.'
            });
        }

        const hashedPassword = await hashPassword(password);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            mobile: mobile ? mobile.trim() : '',
            role: 'student'
        });

        const token = createToken(user);

        return res.status(201).json({
            success: true,
            message: 'Student account created successfully.',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Student registration error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to create student account.'
        });
    }
};

/* ============================================================
   LOGIN
============================================================ */

const login = async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email or password is incorrect.'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'This account has been deactivated.'
            });
        }

        const passwordMatch = await comparePassword(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Email or password is incorrect.'
            });
        }

        const token = createToken(user);

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to login.'
        });
    }
};

module.exports = {
    registerStudent,
    login
};