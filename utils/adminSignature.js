const User = require('../models/user');

const getAdminSignature = async (adminId) => {
    const query = adminId
        ? { _id: adminId, role: 'admin' }
        : { role: 'admin', isActive: true, adminSignatureActive: true, adminSignatureData: { $exists: true } };
    let request = User.findOne(query)
        .select('name role +adminSignatureData +adminSignatureType')
        .lean();
    if (!adminId) request = request.sort({ createdAt: 1 });
    const admin = await request;
    if (!admin?.adminSignatureData || !['image/png', 'image/jpeg'].includes(admin.adminSignatureType)) return null;

    return {
        name: admin.name || 'Portal Administrator',
        image: { data: Buffer.from(admin.adminSignatureData), type: admin.adminSignatureType }
    };
};

module.exports = { getAdminSignature };
