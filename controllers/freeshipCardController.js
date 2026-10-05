const crypto = require('crypto');
const path = require('path');
const { Readable } = require('stream');
const mongoose = require('mongoose');

const FreeshipCardApplication = require('../models/FreeshipCardApplication');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const { createPdf } = require('../utils/simplePdf');
const { encryptAadhaar, decryptAadhaar } = require('../utils/aadhaarCrypto');
const {
    addDocumentTitle,
    addFooter,
    addFullRow,
    addHeader,
    addMetadataStrip,
    addPairRow,
    addSection,
    line: pdfLine,
    rect: pdfRect,
    text: pdfText
} = require('../utils/pdfFormLayout');

const MAX_DOCUMENT_SIZE = 125 * 1024;
const REQUIRED_DOCUMENTS = [
    'photo',
    'incomeCertificate',
    'casteCertificate',
    'passingCertificate'
];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const makeApplicationNumber = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `FSC-${stamp}-${random}`;
};

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

const fileSignatureMatches = (buffer, contentType) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
    if (contentType === 'application/pdf') {
        return buffer.subarray(0, 5).equals(Buffer.from('%PDF-'));
    }
    if (contentType === 'image/jpeg') {
        return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (contentType === 'image/png') {
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    return false;
};

const serializeApplication = (application, { revealAadhaar = false, includeStudent = false } = {}) => {
    const result = application.toObject
        ? application.toObject({ getters: false, virtuals: false })
        : { ...application };
    const personal = result.personalDetails || {};
    const lastFour = personal.aadhaarLastFour || '';

    if (revealAadhaar) {
        personal.aadhaarNumber = decryptAadhaar(personal.aadhaarEncrypted);
    } else {
        personal.aadhaarNumber = lastFour ? `XXXXXXXX${lastFour}` : '';
    }
    delete personal.aadhaarEncrypted;
    delete personal.aadhaarLastFour;
    result.personalDetails = personal;
    result.documents = (result.documents || []).map((document) => ({
        _id: document._id,
        documentType: document.documentType,
        fileName: document.fileName,
        contentType: document.contentType,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt
    }));

    if (!includeStudent) delete result.student;
    return result;
};

const getOrCreateForStudent = async (userId) => {
    let application = await FreeshipCardApplication.findOne({ student: userId })
        .select('+personalDetails.aadhaarEncrypted');
    const user = await User.findById(userId).select('name studentId email mobile');
    if (!user) return null;

    if (application) {
        const accountIdentity = {
            'personalDetails.fullName': user.name || '',
            'personalDetails.applicantId': user.studentId || '',
            'personalDetails.mobile': user.mobile || '',
            'personalDetails.email': user.email || ''
        };
        let changed = false;
        Object.entries(accountIdentity).forEach(([path, value]) => {
            if (application.get(path) !== value) {
                application.set(path, value);
                changed = true;
            }
        });
        if (changed) await application.save();
        return application;
    }

    application = await FreeshipCardApplication.create({
        student: userId,
        applicationNumber: makeApplicationNumber(),
        personalDetails: {
            fullName: user.name || '',
            applicantId: user.studentId || '',
            mobile: user.mobile || '',
            email: user.email || ''
        }
    });
    return application;
};

const getMyApplication = async (req, res) => {
    try {
        const application = await getOrCreateForStudent(req.user.id);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }
        return res.json({ success: true, application: serializeApplication(application, { revealAadhaar: true }) });
    } catch (error) {
        console.error('Load freeship card application error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load the freeship card application.' });
    }
};

const saveMyApplication = async (req, res) => {
    try {
        const application = await getOrCreateForStudent(req.user.id);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }
        if (!['DRAFT', 'REJECTED'].includes(application.status)) {
            return res.status(400).json({ success: false, message: 'This application cannot be edited in its current status.' });
        }

        const personal = req.body?.personalDetails || {};
        const courses = req.body?.courseDetails || {};
        const declarations = req.body?.declarations || {};
        const user = await User.findById(req.user.id).select('name studentId email mobile');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }
        const text = (value, max = 120) => String(value || '').trim().slice(0, max);
        const aadhaar = String(personal.aadhaarNumber || '').replace(/\s/g, '');

        if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
            return res.status(400).json({ success: false, message: 'Aadhaar number must contain exactly 12 digits.' });
        }

        const income = personal.annualFamilyIncome === '' || personal.annualFamilyIncome == null
            ? null
            : Number(personal.annualFamilyIncome);
        if (income !== null && (!Number.isFinite(income) || income < 0 || income > 1000000000)) {
            return res.status(400).json({ success: false, message: 'Enter a valid annual family income.' });
        }

        const dateOfBirth = personal.dateOfBirth ? new Date(personal.dateOfBirth) : null;
        if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
            return res.status(400).json({ success: false, message: 'Enter a valid date of birth.' });
        }

        const updatedPersonal = {
            fullName: user.name || '',
            aadhaarEncrypted: aadhaar ? encryptAadhaar(aadhaar) : '',
            aadhaarLastFour: aadhaar ? aadhaar.slice(-4) : '',
            dateOfBirth,
            fatherName: text(personal.fatherName, 100),
            motherName: text(personal.motherName, 100),
            annualFamilyIncome: income,
            category: text(personal.category, 60),
            applicantId: user.studentId || '',
            mobile: user.mobile || '',
            email: user.email || '',
            village: text(personal.village, 120),
            postOffice: text(personal.postOffice, 120),
            tehsil: text(personal.tehsil, 120),
            district: text(personal.district, 120),
            state: text(personal.state, 100),
            pinCode: text(personal.pinCode, 10)
        };
        Object.entries(updatedPersonal).forEach(([key, value]) => {
            application.set(`personalDetails.${key}`, value);
        });

        const course = (value = {}) => ({
            course: text(value.course, 120),
            branch: text(value.branch, 120),
            year: text(value.year, 40)
        });
        const answer = (value) => {
            if (value === true || value === 'yes') return true;
            if (value === false || value === 'no') return false;
            return null;
        };
        application.courseDetails = {
            presentlyStudying: course(courses.presentlyStudying),
            lastClassStudied: course(courses.lastClassStudied),
            previousClassStudied: course(courses.previousClassStudied)
        };
        application.declarations = {
            hasReadGuidelines: answer(declarations.hasReadGuidelines),
            informationAccurate: answer(declarations.informationAccurate),
            undertakeReimbursement: answer(declarations.undertakeReimbursement)
        };

        await application.save();
        return res.json({ success: true, message: 'Freeship card application saved.', application: serializeApplication(application, { revealAadhaar: true }) });
    } catch (error) {
        console.error('Save freeship card application error:', error);
        return res.status(500).json({ success: false, message: 'Unable to save the freeship card application.' });
    }
};

const uploadDocument = async (req, res) => {
    let newPublicId = '';
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid freeship card application ID.' });
        }
        const documentType = String(req.body?.documentType || '');
        if (!REQUIRED_DOCUMENTS.includes(documentType)) {
            return res.status(400).json({ success: false, message: 'Select a valid freeship card document type.' });
        }
        if (!req.file?.buffer) {
            return res.status(400).json({ success: false, message: 'Please select a document file.' });
        }
        if (req.file.size > MAX_DOCUMENT_SIZE) {
            return res.status(400).json({ success: false, message: 'Each freeship card file must be 125 KB or smaller.' });
        }
        if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype) || !fileSignatureMatches(req.file.buffer, req.file.mimetype)) {
            return res.status(400).json({ success: false, message: 'Upload a valid PDF, JPG, or PNG document.' });
        }
        const extension = path.extname(req.file.originalname || '').toLowerCase();
        const supportedExtensions = {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png']
        };
        if (!supportedExtensions[req.file.mimetype]?.includes(extension)) {
            return res.status(400).json({ success: false, message: 'The file extension does not match its content type.' });
        }
        if (documentType === 'photo' && !['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
            return res.status(400).json({ success: false, message: 'Applicant photo must be a JPG or PNG image.' });
        }

        const query = { _id: req.params.id };
        if (req.user.role !== 'admin') query.student = req.user.id;
        const application = await FreeshipCardApplication.findOne(query);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Freeship card application not found.' });
        }
        if (req.user.role !== 'admin' && !['DRAFT', 'REJECTED'].includes(application.status)) {
            return res.status(400).json({ success: false, message: 'Documents cannot be changed while this application is awaiting or after approval.' });
        }

        const previous = application.documents.find((document) => document.documentType === documentType);
        const publicId = `freeship-cards/${application._id}/${documentType}-${crypto.randomUUID()}`;
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'raw',
                    public_id: publicId,
                    type: 'authenticated',
                    overwrite: false,
                    use_filename: false,
                    unique_filename: false
                },
                (error, result) => error ? reject(error) : resolve(result)
            );
            stream.end(req.file.buffer);
        });
        newPublicId = uploadResult.public_id;

        if (previous) {
            application.documents = application.documents.filter((document) => document.documentType !== documentType);
        }
        application.documents.push({
            documentType,
            fileName: path.basename(req.file.originalname || `${documentType}${extension}`).slice(0, 200),
            cloudinaryPublicId: uploadResult.public_id,
            contentType: req.file.mimetype,
            fileSize: req.file.size,
            uploadedAt: new Date()
        });
        await application.save();

        if (previous?.cloudinaryPublicId) {
            cloudinary.uploader.destroy(previous.cloudinaryPublicId, { resource_type: 'raw', type: 'authenticated' })
                .catch((error) => console.error('Unable to remove replaced freeship card file:', error.message));
        }
        return res.json({
            success: true,
            message: 'Document uploaded.',
            application: serializeApplication(application, { revealAadhaar: req.user.role !== 'admin' })
        });
    } catch (error) {
        if (newPublicId) {
            cloudinary.uploader.destroy(newPublicId, { resource_type: 'raw', type: 'authenticated' })
                .catch((cleanupError) => console.error('Unable to clean up freeship card upload:', cleanupError.message));
        }
        console.error('Freeship card document upload error:', error);
        return res.status(500).json({ success: false, message: 'Unable to upload the freeship card document.' });
    }
};

const submitApplication = async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid freeship card application ID.' });
        }
        const application = await FreeshipCardApplication.findOne({ _id: req.params.id, student: req.user.id })
            .select('+personalDetails.aadhaarEncrypted');
        if (!application) {
            return res.status(404).json({ success: false, message: 'Freeship card application not found.' });
        }
        const user = await User.findById(req.user.id).select('name studentId email mobile');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Student account not found.' });
        }
        application.set('personalDetails.fullName', user.name || '');
        application.set('personalDetails.applicantId', user.studentId || '');
        application.set('personalDetails.mobile', user.mobile || '');
        application.set('personalDetails.email', user.email || '');
        if (!['DRAFT', 'REJECTED'].includes(application.status)) {
            return res.status(400).json({ success: false, message: 'This application has already been submitted.' });
        }

        const personal = application.personalDetails;
        const courses = application.courseDetails;
        const requiredFields = [
            ['student name', personal.fullName],
            ['12-digit Aadhaar number', personal.aadhaarLastFour],
            ['date of birth', personal.dateOfBirth],
            ["father's name", personal.fatherName],
            ["mother's name", personal.motherName],
            ['annual family income', personal.annualFamilyIncome],
            ['category', personal.category],
            ['village or address', personal.village],
            ['tehsil', personal.tehsil],
            ['district', personal.district],
            ['state', personal.state],
            ['PIN code', personal.pinCode]
        ];
        const missing = requiredFields.filter(([, value]) => value === '' || value === null || value === undefined).map(([label]) => label);
        for (const [label, course] of [
            ['present course', courses.presentlyStudying],
            ['last class studied', courses.lastClassStudied],
            ['previous class studied', courses.previousClassStudied]
        ]) {
            if (!course?.course || !course?.branch || !course?.year) missing.push(label);
        }
        const uploadedTypes = new Set(application.documents.map((document) => document.documentType));
        const missingDocuments = REQUIRED_DOCUMENTS.filter((type) => !uploadedTypes.has(type));
        if (missing.length || missingDocuments.length) {
            const messages = [];
            if (missing.length) messages.push(`Complete: ${missing.join(', ')}.`);
            if (missingDocuments.length) messages.push(`Upload: ${missingDocuments.map((type) => type.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}.`);
            return res.status(400).json({ success: false, message: messages.join(' ') });
        }
        if (!/^\d{6}$/.test(personal.pinCode || '')) {
            return res.status(400).json({ success: false, message: 'PIN code must contain exactly 6 digits.' });
        }
        if (!application.declarations.hasReadGuidelines || !application.declarations.informationAccurate || !application.declarations.undertakeReimbursement) {
            return res.status(400).json({ success: false, message: 'Please accept all scheme declarations and the reimbursement undertaking.' });
        }

        application.status = 'PENDING APPROVAL';
        application.submittedAt = new Date();
        application.reviewRemarks = '';
        application.reviewedBy = null;
        application.reviewedAt = null;
        await application.save();
        return res.json({ success: true, message: 'Freeship card application sent for approval.', application: serializeApplication(application, { revealAadhaar: true }) });
    } catch (error) {
        console.error('Submit freeship card application error:', error);
        return res.status(500).json({ success: false, message: 'Unable to submit the freeship card application.' });
    }
};

const pdfDate = (value) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not provided';
const pdfValue = (value) => value === null || value === undefined || value === '' ? 'Not provided' : String(value);

const sendPdf = (res, filename, lines, options = {}) => {
    const buffer = createPdf(lines, options);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
};

const downloadApplicationPerforma = async (req, res) => {
    try {
        const application = await getOrCreateForStudent(req.user.id);
        if (!application) return res.status(404).json({ success: false, message: 'Student account not found.' });
        const personal = application.personalDetails || {};
        const courses = application.courseDetails || {};
        const declarations = application.declarations || {};
        const documents = application.documents || [];
        const coursesText = (course) => [course?.course, course?.branch, course?.year].filter(Boolean).join(' / ') || 'Not provided';
        const documentFile = (type) => documents.find((item) => item.documentType === type)?.fileName || 'Not uploaded';
        const yesNo = (value) => value === true ? 'Yes' : value === false ? 'No' : 'Not answered';
        const page = [];
        addHeader(page, 'freeship');
        addDocumentTitle(page, 'FREESHIP CARD APPLICATION PERFORMA');
        addMetadataStrip(page, 685, [
            { label: 'Application No.', value: application.applicationNumber },
            { label: 'Status', value: application.status === 'DRAFT' ? 'DRAFT - NOT SUBMITTED' : application.status },
            { label: 'Generated', value: pdfDate(new Date()) }
        ]);

        addSection(page, '01. APPLICANT DETAILS', 659, { fill: '#16766E' });
        addPairRow(page, 633, 23, { label: 'Student Name', value: personal.fullName }, { label: 'Student ID', value: personal.applicantId });
        addPairRow(page, 610, 23, { label: 'Mobile', value: personal.mobile }, { label: 'Email', value: personal.email });
        addPairRow(page, 587, 23, { label: 'Aadhaar Number', value: decryptAadhaar(personal.aadhaarEncrypted) }, { label: 'Date of Birth', value: pdfDate(personal.dateOfBirth) });
        addPairRow(page, 564, 23, { label: "Father's Name", value: personal.fatherName }, { label: "Mother's Name", value: personal.motherName });
        addPairRow(page, 541, 23, { label: 'Annual Income (Rs.)', value: personal.annualFamilyIncome }, { label: 'Category', value: personal.category });

        addSection(page, '02. ADDRESS AND COURSE HISTORY', 515, { fill: '#16766E' });
        addPairRow(page, 489, 23, { label: 'Village / Address', value: personal.village }, { label: 'Post Office', value: personal.postOffice });
        addPairRow(page, 466, 23, { label: 'Tehsil', value: personal.tehsil }, { label: 'District', value: personal.district });
        addPairRow(page, 443, 23, { label: 'State', value: personal.state }, { label: 'PIN Code', value: personal.pinCode });
        addFullRow(page, 420, 23, 'Present Course', coursesText(courses.presentlyStudying), { labelWidth: 127, valueSize: 7.8 });
        addFullRow(page, 397, 23, 'Previous Class / Course', coursesText(courses.previousClassStudied), { labelWidth: 127, valueSize: 7.8 });

        addSection(page, '03. UPLOADED DOCUMENTS', 371, { fill: '#16766E' });
        addPairRow(page, 345, 23, { label: 'Applicant Photo', value: documentFile('photo') }, { label: 'Income Certificate', value: documentFile('incomeCertificate') }, { labelSize: 6.8, valueSize: 7.1 });
        addPairRow(page, 322, 23, { label: 'Caste Certificate', value: documentFile('casteCertificate') }, { label: 'Passing Certificate', value: documentFile('passingCertificate') }, { labelSize: 6.8, valueSize: 7.1 });

        addSection(page, '04. STUDENT DECLARATIONS', 296, { fill: '#16766E' });
        addPairRow(page, 270, 23, { label: 'Scheme Provisions Read', value: yesNo(declarations.hasReadGuidelines) }, { label: 'Information Accurate', value: yesNo(declarations.informationAccurate) }, { labelSize: 6.8 });
        addPairRow(page, 247, 23, { label: 'Reimbursement Undertaking', value: yesNo(declarations.undertakeReimbursement) }, { label: 'Submitted On', value: pdfDate(application.submittedAt) }, { labelSize: 6.6 });
        addSection(page, 'APPLICANT SIGNATURE', 218, { fill: '#16766E' });
        pdfText(page, 'Applicant confirms that the details and supporting documents in this performa are accurate.', 39, 197, { size: 7.6, width: 515, wrapAt: 108 });
        pdfLine(page, 363, 145, 555, 145, '#7A8795', 0.8);
        pdfText(page, personal.fullName || 'Student', 363, 130, { size: 8, bold: true, width: 192, align: 'center' });
        pdfText(page, 'Signature of Applicant', 363, 116, { size: 7.2, color: '#536273', width: 192, align: 'center' });
        addFooter(page, 'A draft is not sent to the administration until the student submits it.');
        return sendPdf(res, `${application.applicationNumber}-application.pdf`, [page], { absolutePages: true });
    } catch (error) {
        console.error('Download freeship application PDF error:', error);
        return res.status(500).json({ success: false, message: 'Unable to generate the application PDF.' });
    }
};

const downloadApprovedCard = async (req, res) => {
    try {
        const application = await FreeshipCardApplication.findOne({ student: req.user.id })
            .select('+personalDetails.aadhaarEncrypted')
            .populate('reviewedBy', 'name');
        if (!application) return res.status(404).json({ success: false, message: 'Freeship card application not found.' });
        if (application.status !== 'APPROVED') {
            return res.status(403).json({ success: false, message: 'The Freeship Card PDF is available after the application is approved.' });
        }
        const personal = application.personalDetails || {};
        const courses = application.courseDetails || {};
        const photoDocument = application.documents.find((item) => item.documentType === 'photo');
        let cardPhoto = null;
        if (photoDocument?.cloudinaryPublicId && ['image/jpeg', 'image/png'].includes(photoDocument.contentType)) {
            const savedExtension = path.extname(photoDocument.fileName || '').toLowerCase().slice(1);
            const extension = ['jpg', 'jpeg', 'png'].includes(savedExtension)
                ? savedExtension
                : photoDocument.contentType === 'image/png' ? 'png' : 'jpg';
            const secureUrl = cloudinary.utils.private_download_url(
                photoDocument.cloudinaryPublicId,
                extension,
                { resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 300, secure: true }
            );
            const photoResponse = await fetch(secureUrl);
            if (photoResponse.ok) {
                const photoBuffer = Buffer.from(await photoResponse.arrayBuffer());
                if (photoBuffer.length <= MAX_DOCUMENT_SIZE) {
                    cardPhoto = { data: photoBuffer, type: photoDocument.contentType };
                }
            }
        }
        const address = [personal.village, personal.postOffice, personal.tehsil, personal.district, personal.state, personal.pinCode].filter(Boolean).join(', ');
        const courseText = (course) => [course?.course, course?.branch, course?.year].filter(Boolean).join(' / ') || 'Not provided';
        const adminName = application.reviewedBy?.name || '';
        const fullAadhaar = decryptAadhaar(personal.aadhaarEncrypted);
        const page = [];

        addHeader(page, 'freeship');
        addDocumentTitle(page, 'FREESHIP CARD', 'APPROVAL RECORD');
        addMetadataStrip(page, 684, [
            { label: 'Application No.', value: application.applicationNumber },
            { label: 'Status', value: 'APPROVED' },
            { label: 'Approved On', value: pdfDate(application.reviewedAt) }
        ]);

        addSection(page, 'STUDENT DETAILS', 658, { fill: '#16766E' });
        const identityRow = { x: 32, width: 388, labelWidth: 83, labelSize: 7.3, valueSize: 8.5 };
        addPairRow(page, 628, 30, { label: 'Name of Student', value: personal.fullName }, { label: 'Applicant ID', value: personal.applicantId }, identityRow);
        addPairRow(page, 598, 30, { label: 'Aadhaar No.', value: fullAadhaar || 'Not provided' }, { label: 'Date of Birth', value: pdfDate(personal.dateOfBirth) }, identityRow);
        addPairRow(page, 568, 30, { label: "Father's Name", value: personal.fatherName }, { label: "Mother's Name", value: personal.motherName }, identityRow);
        addPairRow(page, 538, 30, { label: 'Annual Family Income', value: `Rs. ${pdfValue(personal.annualFamilyIncome)}` }, { label: 'Category', value: personal.category }, { ...identityRow, labelSize: 7.0, valueSize: 8.2 });

        pdfRect(page, 420, 538, 143, 120, '#F7FAFC', '#AFC0CF', 0.8);
        if (cardPhoto) {
            page.push({ image: true, x: 457, y: 542, width: 69, height: 112 });
        } else {
            pdfText(page, 'PHOTO NOT', 424, 602, { size: 8, bold: true, color: '#9B2C2C', width: 135, align: 'center' });
            pdfText(page, 'AVAILABLE', 424, 588, { size: 8, bold: true, color: '#9B2C2C', width: 135, align: 'center' });
            pdfText(page, 'Upload JPG or PNG', 424, 574, { size: 6.8, color: '#536273', width: 135, align: 'center' });
        }

        addFullRow(page, 505, 27, 'Present Course', courseText(courses.presentlyStudying), { labelWidth: 112, labelSize: 7.6, valueSize: 8.5 });
        addFullRow(page, 475, 27, 'Previous Class / Course', courseText(courses.previousClassStudied), { labelWidth: 137, labelSize: 7.6, valueSize: 8.5 });

        addSection(page, 'DOCUMENT CHECKLIST', 447, { fill: '#16766E' });
        addFullRow(page, 414, 31, 'Documents on file', 'Applicant photo and required income, caste, and passing certificates.', { labelWidth: 112, labelSize: 7.5, valueSize: 8.5, wrapAt: 90 });

        addSection(page, 'ADDRESS', 385, { fill: '#16766E' });
        addFullRow(page, 339, 42, 'Residential Address', address, { labelWidth: 112, labelSize: 7.6, valueSize: 8.5, leading: 10.5, wrapAt: 82 });

        addSection(page, 'PORTAL APPROVAL', 311, { fill: '#16766E' });
        pdfRect(page, 32, 260, 531, 47, '#FFFFFF', '#C7D2DE');
        pdfText(page, 'This document records approval of the Freeship Card application shown above.', 40, 288, { size: 8.7, width: 515, wrapAt: 96, leading: 11 });
        pdfText(page, 'Use the application number above as your portal reference.', 40, 271, { size: 8.4, width: 515, wrapAt: 102 });

        addSection(page, 'STUDENT DECLARATION', 230, { fill: '#16766E' });
        pdfRect(page, 32, 174, 531, 54, '#FFFFFF', '#C7D2DE');
        pdfText(page, `${personal.fullName || 'The applicant'} accepted the scheme declarations and undertaking when submitting this application.`, 40, 207, { size: 8.6, width: 515, wrapAt: 102, leading: 11 });

        pdfLine(page, 45, 140, 239, 140, '#7A8795', 0.8);
        pdfText(page, 'Signature of Applicant', 45, 123, { size: 7.8, color: '#536273', width: 194, align: 'center' });
        pdfText(page, personal.fullName || 'Student', 45, 107, { size: 8.5, bold: true, width: 194, align: 'center' });
        pdfRect(page, 328, 98, 235, 68, '#EAF4F1', '#91BFB2', 0.8);
        pdfText(page, 'APPROVED IN THE PORTAL', 336, 151, { size: 8.0, bold: true, color: '#176B45', width: 219, align: 'center' });
        pdfText(page, adminName || 'Portal Administrator', 336, 132, { size: 8.6, bold: true, color: '#143E68', width: 219, align: 'center' });
        pdfText(page, `Approval date: ${pdfDate(application.reviewedAt)}`, 336, 113, { size: 7.8, color: '#536273', width: 219, align: 'center' });
        addFooter(page, 'Approval recorded by the University Scholarship Portal.');

        return sendPdf(res, `${application.applicationNumber}-approved-card.pdf`, [page], { absolutePages: true, image: cardPhoto });
    } catch (error) {
        console.error('Download approved Freeship Card PDF error:', error);
        return res.status(500).json({ success: false, message: 'Unable to generate the approved card PDF.' });
    }
};

const getDocument = async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id) || !REQUIRED_DOCUMENTS.includes(req.params.documentType)) {
            return res.status(400).json({ success: false, message: 'Invalid application or document.' });
        }
        const query = { _id: req.params.id };
        if (req.user.role !== 'admin') query.student = req.user.id;
        const application = await FreeshipCardApplication.findOne(query);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Freeship card application not found.' });
        }
        if (req.user.role === 'admin' && application.status === 'DRAFT') {
            return res.status(404).json({ success: false, message: 'Freeship card application not found.' });
        }
        const document = application.documents.find((item) => item.documentType === req.params.documentType);
        if (!document) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }
        const extension = path.extname(document.fileName || '').toLowerCase().slice(1);
        const supported = ['pdf', 'jpg', 'jpeg', 'png'];
        if (!supported.includes(extension) || !ALLOWED_MIME_TYPES.includes(document.contentType)) {
            return res.status(400).json({ success: false, message: 'The document format is not supported.' });
        }
        const secureUrl = cloudinary.utils.private_download_url(
            document.cloudinaryPublicId,
            extension,
            { resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 300, secure: true }
        );
        const cloudResponse = await fetch(secureUrl);
        if (!cloudResponse.ok || !cloudResponse.body) {
            return res.status(502).json({ success: false, message: 'Unable to retrieve this document from secure storage.' });
        }
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Type', document.contentType);
        res.setHeader('Content-Disposition', `inline; filename="${String(document.fileName).replace(/[\r\n"]/g, '_')}"`);
        Readable.fromWeb(cloudResponse.body).pipe(res);
    } catch (error) {
        console.error('Read freeship card document error:', error);
        if (!res.headersSent) return res.status(500).json({ success: false, message: 'Unable to retrieve this document.' });
        return res.end();
    }
};

const getAllForAdmin = async (req, res) => {
    try {
        const status = String(req.query.status || '');
        if (status === 'DRAFT') {
            return res.json({ success: true, applications: [] });
        }
        const filter = ['PENDING APPROVAL', 'APPROVED', 'REJECTED'].includes(status)
            ? { status }
            : { status: { $ne: 'DRAFT' } };
        const applications = await FreeshipCardApplication.find(filter)
            .populate('student', 'name studentId email mobile')
            .sort({ updatedAt: -1 })
            .limit(250);
        return res.json({
            success: true,
            applications: applications.map((application) => serializeApplication(application, { includeStudent: true }))
        });
    } catch (error) {
        console.error('List freeship card applications error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load freeship card applications.' });
    }
};

const getOneForAdmin = async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid freeship card application ID.' });
        const application = await FreeshipCardApplication.findOne({ _id: req.params.id, status: { $ne: 'DRAFT' } })
            .populate('student', 'name studentId email mobile');
        if (!application) return res.status(404).json({ success: false, message: 'Freeship card application not found.' });
        return res.json({ success: true, application: serializeApplication(application, { includeStudent: true }) });
    } catch (error) {
        console.error('Get freeship card application for admin error:', error);
        return res.status(500).json({ success: false, message: 'Unable to load this freeship card application.' });
    }
};

const reviewForAdmin = async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid freeship card application ID.' });
        const action = req.params.action;
        if (!['approve', 'reject'].includes(action)) return res.status(404).json({ success: false, message: 'Review action not found.' });
        const application = await FreeshipCardApplication.findById(req.params.id);
        if (!application) return res.status(404).json({ success: false, message: 'Freeship card application not found.' });
        if (application.status !== 'PENDING APPROVAL') {
            return res.status(400).json({ success: false, message: 'Only applications awaiting approval can be reviewed.' });
        }
        const remarks = String(req.body?.remarks || '').trim().slice(0, 2000);
        if (action === 'reject' && !remarks) {
            return res.status(400).json({ success: false, message: 'Enter a reason so the student can correct the application.' });
        }
        application.status = action === 'approve' ? 'APPROVED' : 'REJECTED';
        application.reviewRemarks = action === 'reject' ? remarks : '';
        application.reviewedBy = req.user.id;
        application.reviewedAt = new Date();
        await application.save();
        return res.json({
            success: true,
            message: action === 'approve' ? 'Freeship card application approved.' : 'Application returned to the student for correction.',
            application: serializeApplication(application, { includeStudent: true })
        });
    } catch (error) {
        console.error('Review freeship card application error:', error);
        return res.status(500).json({ success: false, message: 'Unable to update the freeship card application.' });
    }
};

module.exports = {
    getMyApplication,
    saveMyApplication,
    uploadDocument,
    submitApplication,
    downloadApplicationPerforma,
    downloadApprovedCard,
    getDocument,
    getAllForAdmin,
    getOneForAdmin,
    reviewForAdmin
};
