const crypto = require('crypto');

const generateAdminId = () => `ADM${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

const ensureAdminId = async (admin) => {
    if (admin.adminId) return admin.adminId;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        admin.adminId = generateAdminId();
        try {
            await admin.save();
            return admin.adminId;
        } catch (error) {
            if (error?.code !== 11000 || !error.keyPattern?.adminId) throw error;
            admin.adminId = undefined;
        }
    }
    throw new Error('Unable to generate a unique administrator ID.');
};

module.exports = { generateAdminId, ensureAdminId };
