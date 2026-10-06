const nodemailer = require('nodemailer');

const isEmailDeliveryConfigured = () => Boolean(
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS
);

const createTransporter = () => {
    if (!isEmailDeliveryConfigured()) {
        throw new Error('EMAIL_USER and EMAIL_PASS are required to send email.');
    }

    const port = Number(process.env.EMAIL_PORT || 465);
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port,
        secure: port === 465,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const sendPasswordRecoveryOTP = async (email, otp) => {
    const transporter = createTransporter();
    await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'Your Scholarship Portal password reset code',
        text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
        html: `<p>Your Scholarship Portal password reset code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>`
    });
};

const sendAdminDeletionOTP = async (email, otp, itemCount, itemLabel) => {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'Confirm a destructive action in your Scholarship Portal',
        text: `A request was made to permanently delete ${itemCount} ${itemLabel}. Your confirmation code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email and secure your administrator account.`,
        html: `<p>A request was made to permanently delete <strong>${itemCount} ${itemLabel}</strong>.</p><p>Your confirmation code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>This code expires in 10 minutes. If you did not request this, ignore this email and secure your administrator account.</p>`
    });
    const acceptedAddresses = (info.accepted || []).map((address) =>
        (typeof address === 'string' ? address : address.address || '').trim().toLowerCase()
    );
    if (!acceptedAddresses.includes(email.trim().toLowerCase())) {
        throw new Error('The email provider did not accept the administrator recipient.');
    }
    return info;
};

module.exports = { isEmailDeliveryConfigured, sendPasswordRecoveryOTP, sendAdminDeletionOTP };
