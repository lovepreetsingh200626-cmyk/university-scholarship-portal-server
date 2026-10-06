const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/user');
const StudentProfile = require('../models/StudentProfile');
const ScholarshipApplication = require('../models/ScholarshipApplication');
const FreeshipCardApplication = require('../models/FreeshipCardApplication');
const cloudinary = require('../config/cloudinary');
const { isEmailDeliveryConfigured, sendAdminDeletionOTP } = require('../services/emailService');

const clearChallenge = (admin) => {
    admin.adminDeletionOTPHash = '';
    admin.adminDeletionOTPExpiresAt = null;
    admin.adminDeletionOTPAttempts = 0;
    admin.adminDeletionOTPSentAt = null;
    admin.adminDeletionTargetType = '';
    admin.adminDeletionTargetIds = [];
};

const hashOTP = (otp) => {
    const secret = process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET or PASSWORD_RESET_SECRET is required for OTP protection.');
    return crypto.createHmac('sha256', secret).update(otp).digest('hex');
};

const removePrivateFiles = async (records) => {
    const fileOperations = [];
    records.forEach((record) => {
        (record.documents || []).forEach((document) => {
            if (!document.cloudinaryPublicId) return;
            fileOperations.push(cloudinary.uploader.destroy(document.cloudinaryPublicId, {
                resource_type: 'raw',
                type: 'authenticated'
            }));
        });
    });
    const results = await Promise.allSettled(fileOperations);
    results.filter((result) => result.status === 'rejected').forEach((result) => {
        console.error('Unable to remove a private student document from Cloudinary:', result.reason?.message);
    });
    return results.filter((result) => result.status === 'rejected').length;
};

const requestAdminDeletion = async (req, res) => {
    const { targetType } = req.body || {};
    const submittedIds = req.body?.targetIds;
    const validTypes = ['students', 'scholarshipApplications'];

    if (!validTypes.includes(targetType) || !Array.isArray(submittedIds) || submittedIds.length < 1 || submittedIds.length > 100) {
        return res.status(400).json({ success: false, message: 'Choose between 1 and 100 valid records to delete.' });
    }
    const targetIds = [...new Set(submittedIds)];
    if (targetIds.length !== submittedIds.length || targetIds.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
        return res.status(400).json({ success: false, message: 'The selected records are invalid. Refresh the page and try again.' });
    }
    if (!isEmailDeliveryConfigured()) {
        return res.status(503).json({ success: false, message: 'Admin email delivery is not configured. Deletion cannot be authorized.' });
    }

    try {
        const admin = await User.findOne({ _id: req.user.id, role: 'admin', isActive: true }).select(
            '+adminDeletionOTPHash +adminDeletionOTPExpiresAt +adminDeletionOTPAttempts +adminDeletionOTPSentAt +adminDeletionTargetType +adminDeletionTargetIds'
        );
        if (!admin) return res.status(404).json({ success: false, message: 'Active administrator account not found.' });
        if (admin.adminDeletionOTPSentAt && Date.now() - admin.adminDeletionOTPSentAt.getTime() < 60 * 1000) {
            return res.status(429).json({ success: false, message: 'A deletion code was sent recently. Please wait one minute before requesting another.' });
        }

        let count = 0;
        let itemLabel = '';
        if (targetType === 'students') {
            count = await User.countDocuments({ _id: { $in: targetIds }, role: 'student' });
            itemLabel = 'student account(s) and their linked portal records';
        } else {
            count = await ScholarshipApplication.countDocuments({ _id: { $in: targetIds } });
            itemLabel = 'scholarship application(s)';
        }
        if (count !== targetIds.length) {
            return res.status(400).json({ success: false, message: 'One or more selected records no longer exist. Refresh and select them again.' });
        }

        const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        admin.adminDeletionOTPHash = hashOTP(otp);
        admin.adminDeletionOTPExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        admin.adminDeletionOTPAttempts = 0;
        admin.adminDeletionOTPSentAt = new Date();
        admin.adminDeletionTargetType = targetType;
        admin.adminDeletionTargetIds = targetIds;
        await admin.save();

        try {
            const mailInfo = await sendAdminDeletionOTP(admin.email, otp, count, itemLabel);
            console.info('Admin deletion OTP accepted by email provider.', { messageId: mailInfo.messageId });
        } catch (mailError) {
            clearChallenge(admin);
            await admin.save();
            console.error('Admin deletion OTP delivery failed:', mailError.message);
            return res.status(503).json({ success: false, message: 'Could not send the confirmation code to your admin email. No records were deleted.' });
        }
        return res.json({ success: true, message: `The email provider accepted the confirmation code for ${admin.email}. Check that inbox and its Spam folder. The code expires in 10 minutes.`, count });
    } catch (error) {
        console.error('Admin deletion request error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to start the deletion confirmation process.' });
    }
};

const confirmAdminDeletion = async (req, res) => {
    const confirmation = typeof req.body?.confirmation === 'string' ? req.body.confirmation.trim() : '';
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    if (confirmation !== 'CONFIRM DELETE' || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, message: 'Type CONFIRM DELETE exactly and enter the 6-digit email code.' });
    }

    try {
        const admin = await User.findOne({ _id: req.user.id, role: 'admin', isActive: true }).select(
            '+adminDeletionOTPHash +adminDeletionOTPExpiresAt +adminDeletionOTPAttempts +adminDeletionOTPSentAt +adminDeletionTargetType +adminDeletionTargetIds'
        );
        const invalidOTP = () => res.status(400).json({ success: false, message: 'The deletion code is invalid, expired, or already used. Start the confirmation again.' });
        if (!admin || !admin.adminDeletionOTPHash || !admin.adminDeletionOTPExpiresAt || !admin.adminDeletionTargetIds?.length) return invalidOTP();
        if (admin.adminDeletionOTPExpiresAt.getTime() <= Date.now() || admin.adminDeletionOTPAttempts >= 5) {
            clearChallenge(admin);
            await admin.save();
            return invalidOTP();
        }
        const expected = Buffer.from(admin.adminDeletionOTPHash, 'hex');
        const supplied = Buffer.from(hashOTP(otp), 'hex');
        if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
            admin.adminDeletionOTPAttempts += 1;
            if (admin.adminDeletionOTPAttempts >= 5) clearChallenge(admin);
            await admin.save();
            return invalidOTP();
        }

        const targetIds = admin.adminDeletionTargetIds;
        const targetType = admin.adminDeletionTargetType;
        let deletedCount = 0;
        let failedFileDeletes = 0;
        if (targetType === 'students') {
            const studentIds = (await User.find({ _id: { $in: targetIds }, role: 'student' }).distinct('_id')).map(String);
            if (studentIds.length !== targetIds.length) return res.status(409).json({ success: false, message: 'The selected student records changed. Start the deletion again.' });
            const scholarshipRecords = await ScholarshipApplication.find({ student: { $in: studentIds } }).select('documents').lean();
            const freeshipRecords = await FreeshipCardApplication.find({ student: { $in: studentIds } }).select('documents').lean();
            await Promise.all([
                ScholarshipApplication.deleteMany({ student: { $in: studentIds } }),
                FreeshipCardApplication.deleteMany({ student: { $in: studentIds } }),
                StudentProfile.deleteMany({ user: { $in: studentIds } })
            ]);
            const result = await User.deleteMany({ _id: { $in: studentIds }, role: 'student' });
            deletedCount = result.deletedCount;
            failedFileDeletes += await removePrivateFiles([...scholarshipRecords, ...freeshipRecords]);
        } else if (targetType === 'scholarshipApplications') {
            const records = await ScholarshipApplication.find({ _id: { $in: targetIds } }).select('documents').lean();
            if (records.length !== targetIds.length) return res.status(409).json({ success: false, message: 'One or more applications changed. Start the deletion again.' });
            const result = await ScholarshipApplication.deleteMany({ _id: { $in: targetIds } });
            deletedCount = result.deletedCount;
            failedFileDeletes += await removePrivateFiles(records);
        } else {
            clearChallenge(admin);
            await admin.save();
            return res.status(400).json({ success: false, message: 'The pending deletion request is invalid.' });
        }

        clearChallenge(admin);
        await admin.save();
        const message = failedFileDeletes
            ? `${deletedCount} record(s) deleted. ${failedFileDeletes} stored document(s) could not be removed automatically; check Cloudinary storage.`
            : `${deletedCount} record(s) deleted successfully.`;
        return res.json({ success: true, message, deletedCount, failedFileDeletes });
    } catch (error) {
        console.error('Admin deletion confirmation error:', error.message);
        return res.status(500).json({ success: false, message: 'Unable to complete the deletion. Check whether the selected records still exist before retrying.' });
    }
};

module.exports = { requestAdminDeletion, confirmAdminDeletion };
