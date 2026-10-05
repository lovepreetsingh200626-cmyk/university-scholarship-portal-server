const crypto = require('crypto');

const encryptionKey = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required to protect Aadhaar data.');
    }

    return crypto
        .createHash('sha256')
        .update(`freeship-card-aadhaar:${process.env.JWT_SECRET}`)
        .digest();
};

const encryptAadhaar = (value) => {
    const aadhaar = String(value || '').replace(/\s/g, '');
    if (!aadhaar) return '';

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(aadhaar, 'utf8'),
        cipher.final()
    ]);

    return [iv, cipher.getAuthTag(), encrypted]
        .map((part) => part.toString('base64url'))
        .join('.');
};

const decryptAadhaar = (value) => {
    if (!value) return '';
    const [ivText, tagText, encryptedText] = value.split('.');
    if (!ivText || !tagText || !encryptedText) return '';

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        encryptionKey(),
        Buffer.from(ivText, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64url')),
        decipher.final()
    ]).toString('utf8');
};

module.exports = { encryptAadhaar, decryptAadhaar };
