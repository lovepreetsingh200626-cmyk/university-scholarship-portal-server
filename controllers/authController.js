const User = require('../models/User');

const {
    hashPassword,
    comparePassword,
    createToken
} = require('../utils/auth');


/* ============================================================
   VALIDATION HELPERS
============================================================ */

/*
   Basic email validation.
*/
const isValidEmail = (email) => {
    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(email);
};


/*
   Student name validation.
*/
const isValidName = (name) => {
    if (typeof name !== 'string') {
        return false;
    }

    const trimmedName = name.trim();

    if (
        trimmedName.length < 2 ||
        trimmedName.length > 100
    ) {
        return false;
    }

    return true;
};


/*
   Password validation.
*/
const isValidPassword = (password) => {
    if (typeof password !== 'string') {
        return false;
    }

    return (
        password.length >= 8 &&
        password.length <= 128
    );
};


/*
   Mobile number validation.

   Mobile is optional during registration,
   but if provided it must contain 10 digits.
*/
const isValidMobile = (mobile) => {
    if (
        mobile === undefined ||
        mobile === null ||
        mobile === ''
    ) {
        return true;
    }

    if (typeof mobile !== 'string') {
        return false;
    }

    const mobileRegex = /^[0-9]{10}$/;

    return mobileRegex.test(
        mobile.trim()
    );
};


/* ============================================================
   REGISTER STUDENT
============================================================ */

const registerStudent = async (req, res) => {
    try {

        /* --------------------------------------------------------
           CHECK REQUEST BODY
        -------------------------------------------------------- */

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration data.'
            });
        }


        /* --------------------------------------------------------
           READ INPUT
        -------------------------------------------------------- */

        const {
            name,
            email,
            password,
            mobile
        } = req.body;


        /* --------------------------------------------------------
           REQUIRED FIELD CHECK
        -------------------------------------------------------- */

        if (
            name === undefined ||
            email === undefined ||
            password === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Name, email and password are required.'
            });
        }


        /* --------------------------------------------------------
           TYPE VALIDATION
        -------------------------------------------------------- */

        if (
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Name, email and password must be valid text values.'
            });
        }


        /* --------------------------------------------------------
           NORMALIZE INPUT
        -------------------------------------------------------- */

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();


        /* --------------------------------------------------------
           NAME VALIDATION
        -------------------------------------------------------- */

        if (!isValidName(normalizedName)) {
            return res.status(400).json({
                success: false,
                message:
                    'Name must contain between 2 and 100 characters.'
            });
        }


        /* --------------------------------------------------------
           EMAIL VALIDATION
        -------------------------------------------------------- */

        if (
            normalizedEmail.length > 254 ||
            !isValidEmail(normalizedEmail)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please enter a valid email address.'
            });
        }


        /* --------------------------------------------------------
           PASSWORD VALIDATION
        -------------------------------------------------------- */

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message:
                    'Password must contain between 8 and 128 characters.'
            });
        }


        /* --------------------------------------------------------
           MOBILE VALIDATION
        -------------------------------------------------------- */

        if (!isValidMobile(mobile)) {
            return res.status(400).json({
                success: false,
                message:
                    'Mobile number must contain exactly 10 digits.'
            });
        }


        /* --------------------------------------------------------
           CHECK EXISTING ACCOUNT
        -------------------------------------------------------- */

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message:
                    'An account with this email already exists.'
            });
        }


        /* --------------------------------------------------------
           HASH PASSWORD
        -------------------------------------------------------- */

        const hashedPassword =
            await hashPassword(password);


        /* --------------------------------------------------------
           CREATE STUDENT ACCOUNT
        -------------------------------------------------------- */

        const user = await User.create({
            name: normalizedName,
            email: normalizedEmail,
            password: hashedPassword,
            mobile:
                mobile && typeof mobile === 'string'
                    ? mobile.trim()
                    : '',
            role: 'student'
        });


        /* --------------------------------------------------------
           CREATE JWT
        -------------------------------------------------------- */

        const token = createToken(user);


        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */

        return res.status(201).json({
            success: true,
            message:
                'Student account created successfully.',
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

        console.error(
            'Student registration error:',
            error
        );

        /* --------------------------------------------------------
           HANDLE MONGOOSE DUPLICATE KEY
        -------------------------------------------------------- */

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message:
                    'An account with this email already exists.'
            });
        }


        return res.status(500).json({
            success: false,
            message:
                'Unable to create student account.'
        });
    }
};


/* ============================================================
   LOGIN
============================================================ */

const login = async (req, res) => {
    try {

        /* --------------------------------------------------------
           CHECK REQUEST BODY
        -------------------------------------------------------- */

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid login data.'
            });
        }


        /* --------------------------------------------------------
           READ INPUT
        -------------------------------------------------------- */

        const {
            email,
            password
        } = req.body;


        /* --------------------------------------------------------
           REQUIRED FIELD CHECK
        -------------------------------------------------------- */

        if (
            email === undefined ||
            password === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Email and password are required.'
            });
        }


        /* --------------------------------------------------------
           TYPE VALIDATION
        -------------------------------------------------------- */

        if (
            typeof email !== 'string' ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Email and password must be valid text values.'
            });
        }


        /* --------------------------------------------------------
           NORMALIZE EMAIL
        -------------------------------------------------------- */

        const normalizedEmail =
            email.trim().toLowerCase();


        /* --------------------------------------------------------
           EMAIL VALIDATION
        -------------------------------------------------------- */

        if (
            normalizedEmail.length > 254 ||
            !isValidEmail(normalizedEmail)
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Email or password is incorrect.'
            });
        }


        /* --------------------------------------------------------
           PASSWORD LENGTH CHECK
        -------------------------------------------------------- */

        if (
            password.length < 8 ||
            password.length > 128
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Email or password is incorrect.'
            });
        }


        /* --------------------------------------------------------
           FIND USER
        -------------------------------------------------------- */

        const user = await User.findOne({
            email: normalizedEmail
        });


        /* --------------------------------------------------------
           ACCOUNT NOT FOUND
        -------------------------------------------------------- */

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    'Email or password is incorrect.'
            });
        }


        /* --------------------------------------------------------
           ACCOUNT STATUS
        -------------------------------------------------------- */

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message:
                    'This account has been deactivated.'
            });
        }


        /* --------------------------------------------------------
           PASSWORD CHECK
        -------------------------------------------------------- */

        const passwordMatch =
            await comparePassword(
                password,
                user.password
            );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message:
                    'Email or password is incorrect.'
            });
        }


        /* --------------------------------------------------------
           CREATE JWT
        -------------------------------------------------------- */

        const token = createToken(user);


        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */

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

        console.error(
            'Login error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to login.'
        });
    }
};


/* ============================================================
   EXPORT
============================================================ */

module.exports = {
    registerStudent,
    login
};