const crypto = require('crypto');

const User = require('../models/user');
const { isEmailDeliveryConfigured, sendPasswordRecoveryOTP } = require('../services/emailService');

const {
    hashPassword,
    comparePassword,
    createToken
} = require('../utils/auth');


/* ============================================================
   VALIDATION HELPERS
============================================================ */

const isValidEmail = (email) => {
    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(email);
};


const isValidName = (name) => {
    if (typeof name !== 'string') {
        return false;
    }

    const trimmedName = name.trim();

    return (
        trimmedName.length >= 2 &&
        trimmedName.length <= 100
    );
};


const isValidMobile = (mobile) => {
    if (typeof mobile !== 'string') {
        return false;
    }

    return /^[0-9]{10}$/.test(
        mobile.trim()
    );
};


const isValidPassword = (password) => {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        password.length <= 128
    );
};


/* ============================================================
   STUDENT ID GENERATION
============================================================ */

const generateStudentId = () => {
    const year =
        new Date()
            .getFullYear()
            .toString()
            .slice(-2);

    const randomPart =
        crypto
            .randomBytes(5)
            .toString('hex')
            .toUpperCase();

    return `USP${year}${randomPart}`;
};


/* ============================================================
   INITIAL PASSWORD GENERATION
============================================================ */

const generateInitialPassword = () => {
    const randomPart =
        crypto
            .randomBytes(9)
            .toString('base64url');

    return `Stu@${randomPart}`;
};

const hashRecoveryOTP = (otp) => {
    const secret = process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET or PASSWORD_RESET_SECRET is required for password recovery.');
    return crypto.createHmac('sha256', secret).update(otp).digest('hex');
};

const clearRecoveryOTP = (user) => {
    user.passwordResetOTPHash = '';
    user.passwordResetOTPExpiresAt = null;
    user.passwordResetOTPAttempts = 0;
    user.passwordResetOTPSentAt = null;
};


/* ============================================================
   REGISTER STUDENT
============================================================ */

const registerStudent = async (req, res) => {
    try {

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid registration data.'
            });
        }


        const {
            name,
            email,
            mobile
        } = req.body;


        if (
            name === undefined ||
            email === undefined ||
            mobile === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Name, email and mobile number are required.'
            });
        }


        if (
            typeof name !== 'string' ||
            typeof email !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Name and email must be valid text values.'
            });
        }


        const normalizedName =
            name.trim();

        const normalizedEmail =
            email
                .trim()
                .toLowerCase();

        const normalizedMobile =
            typeof mobile === 'string'
                ? mobile.trim()
                : '';


        if (
            !isValidName(
                normalizedName
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Name must contain between 2 and 100 characters.'
            });
        }


        if (
            normalizedEmail.length > 254 ||
            !isValidEmail(
                normalizedEmail
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please enter a valid email address.'
            });
        }


        if (
            !normalizedMobile ||
            !isValidMobile(
                normalizedMobile
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Mobile number must contain exactly 10 digits.'
            });
        }


        const existingEmailUser =
            await User.findOne({
                email: normalizedEmail
            });

        if (existingEmailUser) {
            return res.status(409).json({
                success: false,
                message:
                    'An account with this email already exists.'
            });
        }


        let studentId;
        let credentialGenerationSuccessful =
            false;


        for (
            let attempt = 0;
            attempt < 5;
            attempt++
        ) {
            studentId =
                generateStudentId();

            const existingStudent =
                await User.findOne({
                    studentId
                });

            if (!existingStudent) {
                credentialGenerationSuccessful =
                    true;

                break;
            }
        }


        if (
            !credentialGenerationSuccessful
        ) {
            return res.status(500).json({
                success: false,
                message:
                    'Unable to generate a unique student ID. Please try again.'
            });
        }


        const initialPassword =
            generateInitialPassword();


        const hashedPassword =
            await hashPassword(
                initialPassword
            );


        const user =
            await User.create({
                name:
                    normalizedName,

                studentId:
                    studentId,

                email:
                    normalizedEmail,

                password:
                    hashedPassword,

                mustChangePassword:
                    true,

                mobile:
                    normalizedMobile,

                role:
                    'student',

                isActive:
                    true
            });


        const token =
            createToken(user);


        return res.status(201).json({
            success: true,

            message:
                'Student registration completed successfully.',

            credentials: {
                studentId:
                    user.studentId,

                initialPassword:
                    initialPassword
            },

            token,

            user: {
                id:
                    user._id,

                studentId:
                    user.studentId,

                name:
                    user.name,

                email:
                    user.email,

                mobile:
                    user.mobile,

                role:
                    user.role,

                mustChangePassword:
                    user.mustChangePassword,

                isActive:
                    user.isActive
            }
        });

    } catch (error) {

        console.error(
            'Student registration error:',
            error
        );


        if (
            error &&
            error.code === 11000
        ) {
            const duplicateFields =
                Object.keys(
                    error.keyPattern || {}
                );

            if (
                duplicateFields.includes(
                    'email'
                )
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        'An account with this email already exists.'
                });
            }


            if (
                duplicateFields.includes(
                    'studentId'
                )
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        'A student ID conflict occurred. Please register again.'
                });
            }


            return res.status(409).json({
                success: false,
                message:
                    'An account with the provided information already exists.'
            });
        }


        return res.status(500).json({
            success: false,
            message:
                'Unable to complete student registration.'
        });
    }
};


/* ============================================================
   LOGIN
============================================================ */

const login = async (req, res) => {
    try {

        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid login data.'
            });
        }


        const {
            studentId,
            email,
            password
        } = req.body;


        if (
            password === undefined ||
            typeof password !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Password is required.'
            });
        }


        if (
            !isValidPassword(password)
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Login credentials are incorrect.'
            });
        }


        /* ========================================================
           STUDENT LOGIN
        ======================================================== */

        if (
            typeof studentId === 'string' &&
            studentId.trim()
        ) {

            const normalizedStudentId =
                studentId
                    .trim()
                    .toUpperCase();


            const user =
                await User.findOne({
                    studentId:
                        normalizedStudentId
                });


            if (!user) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Login credentials are incorrect.'
                });
            }


            if (
                user.role !== 'student'
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Login credentials are incorrect.'
                });
            }


            if (!user.isActive) {
                return res.status(403).json({
                    success: false,
                    message:
                        'This account has been deactivated.'
                });
            }


            const passwordMatch =
                await comparePassword(
                    password,
                    user.password
                );


            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Login credentials are incorrect.'
                });
            }


            const token =
                createToken(user);


            return res.status(200).json({
                success: true,

                message:
                    'Login successful.',

                token,

                user: {
                    id:
                        user._id,

                    studentId:
                        user.studentId,

                    name:
                        user.name,

                    email:
                        user.email,

                    mobile:
                        user.mobile,

                    role:
                        user.role,

                    mustChangePassword:
                        user.mustChangePassword,

                    isActive:
                        user.isActive
                }
            });
        }


        /* ========================================================
           ADMIN LOGIN
        ======================================================== */

        if (
            typeof email !== 'string' ||
            !email.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Student ID is required for student login.'
            });
        }


        const normalizedEmail =
            email
                .trim()
                .toLowerCase();


        if (
            normalizedEmail.length > 254 ||
            !isValidEmail(
                normalizedEmail
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Login credentials are incorrect.'
            });
        }


        const user =
            await User.findOne({
                email:
                    normalizedEmail
            });


        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    'Login credentials are incorrect.'
            });
        }


        if (
            user.role === 'student'
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Please login using your Student ID.'
            });
        }


        if (
            user.role !== 'admin'
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Login credentials are incorrect.'
            });
        }


        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message:
                    'This account has been deactivated.'
            });
        }


        const passwordMatch =
            await comparePassword(
                password,
                user.password
            );


        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message:
                    'Login credentials are incorrect.'
            });
        }


        const token =
            createToken(user);


        return res.status(200).json({
            success: true,

            message:
                'Login successful.',

            token,

            user: {
                id:
                    user._id,

                studentId:
                    user.studentId || '',

                name:
                    user.name,

                email:
                    user.email,

                mobile:
                    user.mobile,

                role:
                    user.role,

                mustChangePassword:
                    user.mustChangePassword,

                isActive:
                    user.isActive
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
   CHANGE PASSWORD
============================================================ */

const changePassword = async (req, res) => {
    try {

        if (
            !req.user ||
            !req.user.id
        ) {
            return res.status(401).json({
                success: false,
                message:
                    'Authentication required.'
            });
        }


        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid password change data.'
            });
        }


        const {
            currentPassword,
            newPassword
        } = req.body;


        if (
            typeof currentPassword !== 'string' ||
            typeof newPassword !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Current password and new password are required.'
            });
        }


        if (
            !isValidPassword(
                currentPassword
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Current password is invalid.'
            });
        }


        if (
            !isValidPassword(
                newPassword
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'New password must contain between 8 and 128 characters.'
            });
        }


        if (
            currentPassword === newPassword
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'New password must be different from the current password.'
            });
        }


        const user =
            await User.findById(
                req.user.id
            );


        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    'Account not found.'
            });
        }


        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message:
                    'This account has been deactivated.'
            });
        }


        const currentPasswordMatch =
            await comparePassword(
                currentPassword,
                user.password
            );


        if (!currentPasswordMatch) {
            return res.status(401).json({
                success: false,
                message:
                    'Current password is incorrect.'
            });
        }


        const hashedNewPassword =
            await hashPassword(
                newPassword
            );


        user.password =
            hashedNewPassword;

        user.mustChangePassword = false;

        clearRecoveryOTP(user);

        await user.save();


        const token =
            createToken(user);


        return res.status(200).json({
            success: true,

            message:
                'Password changed successfully.',

            token,

            user: {
                id: user._id,
                studentId: user.studentId || '',
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                role: user.role,
                mustChangePassword: false,
                isActive: user.isActive
            }
        });

    } catch (error) {

        console.error(
            'Change password error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to change password.'
        });
    }
};


/* ============================================================
   PASSWORD RECOVERY BY EMAIL OTP
============================================================ */

const requestPasswordReset = async (req, res) => {
    const accountRole = req.body?.accountRole === 'admin' ? 'admin' : 'student';
    const accountId = accountRole === 'admin' ? req.body?.adminId : req.body?.studentId;
    const normalizedId = typeof accountId === 'string' ? accountId.trim().toUpperCase() : '';
    const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile.trim() : '';
    const email = typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (!normalizedId || normalizedId.length > 30 || !isValidMobile(mobile) || !isValidEmail(email) || email.length > 254) {
        return res.status(400).json({ success: false, message: `Enter your ${accountRole === 'admin' ? 'Admin ID' : 'Student ID'}, 10-digit mobile number, and registered email address.` });
    }
    if (!isEmailDeliveryConfigured()) {
        return res.status(503).json({ success: false, message: 'Email recovery is not configured yet. Contact the portal administrator.' });
    }

    try {
        const identityQuery = accountRole === 'admin'
            ? { adminId: normalizedId, mobile, email, role: 'admin', isActive: true }
            : { studentId: normalizedId, mobile, email, role: 'student', isActive: true };
        const user = await User.findOne(identityQuery).select(
            '+passwordResetOTPHash +passwordResetOTPExpiresAt +passwordResetOTPAttempts +passwordResetOTPSentAt'
        );
        if (!user || !user.isActive) {
            return res.status(400).json({ success: false, message: `The ${accountRole === 'admin' ? 'Admin ID' : 'Student ID'}, mobile number, and email do not match an active ${accountRole} account.` });
        }

        if (user.passwordResetOTPSentAt && Date.now() - user.passwordResetOTPSentAt.getTime() < 60 * 1000) {
            return res.status(429).json({ success: false, message: 'A recovery code was sent recently. Please wait one minute before requesting another.' });
        }

        const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        user.passwordResetOTPHash = hashRecoveryOTP(otp);
        user.passwordResetOTPExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        user.passwordResetOTPAttempts = 0;
        user.passwordResetOTPSentAt = new Date();
        await user.save();

        try {
            await sendPasswordRecoveryOTP(user.email, otp);
        } catch (mailError) {
            clearRecoveryOTP(user);
            await user.save();
            console.error('Password recovery email delivery failed:', mailError.message);
            return res.status(503).json({ success: false, message: 'We verified your details, but could not send the recovery code. Please try again later.' });
        }

        return res.json({ success: true, message: 'Your details are verified. Check your registered email inbox for the recovery code. If it is not there, check your spam folder.' });
    } catch (error) {
        console.error('Password recovery request error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to request a recovery code right now.' });
    }
};

const resetPasswordWithOTP = async (req, res) => {
    const accountRole = req.body?.accountRole === 'admin' ? 'admin' : 'student';
    const accountId = accountRole === 'admin' ? req.body?.adminId : req.body?.studentId;
    const normalizedId = typeof accountId === 'string' ? accountId.trim().toUpperCase() : '';
    const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile.trim() : '';
    const email = typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    const newPassword = req.body?.newPassword;

    if (!normalizedId || normalizedId.length > 30 || !isValidMobile(mobile) || !isValidEmail(email) || email.length > 254 || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, message: `Enter your ${accountRole === 'admin' ? 'Admin ID' : 'Student ID'}, 10-digit mobile number, registered email, and 6-digit recovery code.` });
    }
    if (!isValidPassword(newPassword)) {
        return res.status(400).json({ success: false, message: 'New password must contain between 8 and 128 characters.' });
    }

    try {
        const identityQuery = accountRole === 'admin'
            ? { adminId: normalizedId, mobile, email, role: 'admin', isActive: true }
            : { studentId: normalizedId, mobile, email, role: 'student', isActive: true };
        const user = await User.findOne(identityQuery).select(
            '+passwordResetOTPHash +passwordResetOTPExpiresAt +passwordResetOTPAttempts +passwordResetOTPSentAt'
        );
        const invalidCode = () => res.status(400).json({ success: false, message: 'The recovery code is invalid or expired. Request a new code and try again.' });
        if (!user || !user.isActive || !user.passwordResetOTPHash || !user.passwordResetOTPExpiresAt) {
            return invalidCode();
        }
        if (user.passwordResetOTPExpiresAt.getTime() <= Date.now() || user.passwordResetOTPAttempts >= 5) {
            clearRecoveryOTP(user);
            await user.save();
            return invalidCode();
        }

        const expected = Buffer.from(user.passwordResetOTPHash, 'hex');
        const supplied = Buffer.from(hashRecoveryOTP(otp), 'hex');
        const matches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
        if (!matches) {
            user.passwordResetOTPAttempts += 1;
            if (user.passwordResetOTPAttempts >= 5) clearRecoveryOTP(user);
            await user.save();
            return invalidCode();
        }

        user.password = await hashPassword(newPassword);
        user.mustChangePassword = false;
        clearRecoveryOTP(user);
        await user.save();
        return res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
    } catch (error) {
        console.error('Password reset error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to reset the password right now.' });
    }
};


/* ============================================================
   EXPORT
============================================================ */

module.exports = {
    registerStudent,
    login,
    changePassword,
    requestPasswordReset,
    resetPasswordWithOTP
};
