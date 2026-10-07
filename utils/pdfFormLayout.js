const { createPdf } = require('./simplePdf');

const PAGE_WIDTH = 595;
const CONTENT_X = 32;
const CONTENT_WIDTH = 531;

const COLOR = {
    ink: '#1D2939',
    muted: '#536273',
    border: '#C7D2DE',
    label: '#EEF3F8',
    white: '#FFFFFF',
    navy: '#143E68',
    blue: '#3F7EAE',
    paleBlue: '#E7F1FA',
    teal: '#16766E',
    paleTeal: '#E2F1ED',
    green: '#176B45'
};

const rect = (page, x, y, width, height, fill = COLOR.white, stroke = COLOR.border, lineWidth = 0.55) => {
    page.push({ shape: 'rect', x, y, width, height, fill, stroke, lineWidth });
};
const circle = (page, cx, cy, radius, fill = COLOR.white, stroke = COLOR.border, lineWidth = 0.8) => {
    page.push({ shape: 'circle', cx, cy, radius, fill, stroke, lineWidth });
};

const addApprovalStamp = (page, cx, cy, radius = 38, options = {}) => {
    const ink = options.color || '#9D2D35';
    const pale = options.fill || '#FFF9F7';
    circle(page, cx, cy, radius, pale, ink, 2.1);
    circle(page, cx, cy, radius - 4, pale, ink, 0.85);
    const glyphWidths = { A: 722, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, ' ': 278 };
    const centered = (value, y, size) => {
        const label = String(value);
        const measuredWidth = Array.from(label.toUpperCase()).reduce((sum, character) => sum + (glyphWidths[character] || 600), 0) * size / 1000;
        text(page, label, cx - measuredWidth / 2, y, { size, bold: true, color: ink });
    };
    centered(options.orgLabel || 'UNIVERSITY PORTAL', cy + radius * 0.49, Math.max(4.2, radius * 0.12));
    centered('AUTHORITY', cy + radius * 0.10, Math.max(5.8, radius * 0.18));
    centered(options.centerLabel || 'APPROVED', cy - radius * 0.19, Math.max(6.8, radius * 0.22));
    centered(options.footerLabel || 'OFFICIAL RECORD', cy - radius * 0.57, Math.max(4.2, radius * 0.12));
};

const line = (page, x1, y1, x2, y2, color = COLOR.border, lineWidth = 0.55) => {
    page.push({ shape: 'line', x1, y1, x2, y2, color, lineWidth });
};

const text = (page, value, x, y, options = {}) => {
    page.push({
        text: String(value ?? ''),
        x,
        y,
        size: options.size || 8.3,
        bold: options.bold || false,
        font: options.font,
        color: options.color || COLOR.ink,
        width: options.width,
        align: options.align,
        wrapAt: options.wrapAt,
        leading: options.leading
    });
};

const addHeader = (page, variant = 'scholarship') => {
    const isFreeship = variant === 'freeship';
    const background = isFreeship ? '#D8EEE9' : '#E7F1FA';
    const accent = isFreeship ? COLOR.teal : COLOR.navy;
    rect(page, CONTENT_X, 758, CONTENT_WIDTH, 58, background, background, 0);
    rect(page, CONTENT_X, 758, 7, 58, accent, accent, 0);
    text(page, 'UNIVERSITY SCHOLARSHIP PORTAL', CONTENT_X + 15, 794, { size: 16.2, bold: true, font: 'serif', color: accent, width: CONTENT_WIDTH - 30, align: 'center' });
    text(page, 'Student funding and Freeship Card services', CONTENT_X + 15, 777, { size: 9.2, color: accent, width: CONTENT_WIDTH - 30, align: 'center' });
    text(page, isFreeship ? 'FREESHIP CARD SERVICES' : 'STUDENT APPLICATION SERVICES', CONTENT_X + 15, 763, { size: 7.4, bold: true, color: accent, width: CONTENT_WIDTH - 30, align: 'center' });
};

const addDocumentTitle = (page, title, subtitle = '') => {
    text(page, title, CONTENT_X, 738, { size: 15, bold: true, font: 'serif', color: COLOR.navy, width: CONTENT_WIDTH, align: 'center' });
    if (subtitle) text(page, subtitle, CONTENT_X, 723, { size: 8.2, color: COLOR.muted, width: CONTENT_WIDTH, align: 'center' });
    line(page, CONTENT_X, 714, CONTENT_X + CONTENT_WIDTH, 714, COLOR.navy, 0.9);
};

const addSection = (page, title, y, options = {}) => {
    const height = options.height || 18;
    const fill = options.fill || COLOR.blue;
    rect(page, CONTENT_X, y, options.width || CONTENT_WIDTH, height, fill, fill, 0);
    text(page, title, CONTENT_X + 7, y + 5, { size: options.size || 8.8, bold: true, color: COLOR.white });
};

const valueText = (value) => {
    if (value === null || value === undefined || value === '') return 'Not applicable';
    return String(value);
};

const drawPairCell = (page, x, y, width, height, field, options = {}) => {
    const labelWidth = options.labelWidth || 91;
    const labelSize = options.labelSize || 7.1;
    const valueSize = options.valueSize || 8.1;
    rect(page, x, y, labelWidth, height, options.labelFill || COLOR.label, COLOR.border);
    rect(page, x + labelWidth, y, width - labelWidth, height, COLOR.white, COLOR.border);
    const baseline = y + height / 2 - labelSize * 0.3;
    text(page, field?.label || '', x + 5, baseline, {
        size: labelSize,
        bold: true,
        width: labelWidth - 10,
        wrapAt: Math.max(1, Math.floor((labelWidth - 10) / (labelSize * 0.53)))
    });
    const value = valueText(field?.value);
    const availableWidth = width - labelWidth - 10;
    const wrapAt = Math.max(1, Math.floor(availableWidth / (valueSize * 0.53)));
    const fitSize = value.length <= wrapAt ? valueSize : Math.max(options.minValueSize || 6.2, valueSize * (wrapAt / value.length));
    const fittedWrapAt = Math.max(wrapAt, Math.floor(availableWidth / (fitSize * 0.53)));
    text(page, value, x + labelWidth + 5, y + height / 2 - fitSize * 0.3, {
        size: fitSize,
        width: availableWidth,
        wrapAt: options.valueWrapAt || fittedWrapAt
    });
};

const addPairRow = (page, y, height, left, right, options = {}) => {
    const x = options.x ?? CONTENT_X;
    const width = options.width ?? CONTENT_WIDTH;
    const halfWidth = width / 2;
    drawPairCell(page, x, y, halfWidth, height, left, options);
    drawPairCell(page, x + halfWidth, y, halfWidth, height, right, options);
};

const addFullRow = (page, y, height, label, value, options = {}) => {
    const x = options.x ?? CONTENT_X;
    const width = options.width ?? CONTENT_WIDTH;
    const labelWidth = options.labelWidth || 112;
    const labelSize = options.labelSize || 7.4;
    const valueSize = options.valueSize || 8.0;
    rect(page, x, y, labelWidth, height, COLOR.label, COLOR.border);
    rect(page, x + labelWidth, y, width - labelWidth, height, COLOR.white, COLOR.border);
    text(page, label, x + 5, y + height / 2 - labelSize * 0.3, {
        size: labelSize,
        bold: true,
        width: labelWidth - 10,
        wrapAt: options.labelWrapAt || Math.max(1, Math.floor((labelWidth - 10) / (labelSize * 0.53)))
    });
    const valueX = x + labelWidth + 5;
    const valueWidth = width - labelWidth - 10;
    const wrapAt = options.wrapAt || Math.max(1, Math.floor(valueWidth / (valueSize * 0.53)));
    const maxLines = Math.max(1, Math.floor((height - 6) / (options.leading || valueSize + 2)));
    const rawValue = valueText(value);
    const valueSizeFit = rawValue.length <= wrapAt * maxLines
        ? valueSize
        : Math.max(6.2, valueSize * ((wrapAt * maxLines) / rawValue.length));
    text(page, rawValue, valueX, y + height - valueSizeFit - 4, {
        size: valueSizeFit,
        width: valueWidth,
        wrapAt,
        leading: options.leading || valueSizeFit + 2
    });
};

const addMetadataStrip = (page, y, entries) => {
    const cellWidth = CONTENT_WIDTH / entries.length;
    entries.forEach((entry, index) => {
        const x = CONTENT_X + index * cellWidth;
        const height = 26;
        const label = String(entry.label || '').toUpperCase();
        const value = valueText(entry.value);
        const availableWidth = cellWidth - 12;
        const fontSize = Math.max(6.2, Math.min(8.2, availableWidth / Math.max(1, value.length * 0.53)));
        rect(page, x, y, cellWidth, height, COLOR.paleBlue, COLOR.border);
        text(page, label, x + 6, y + 17, {
            size: 6.4,
            bold: true,
            color: COLOR.navy,
            width: availableWidth,
            wrapAt: label.length
        });
        text(page, value, x + 6, y + 5, {
            size: fontSize,
            bold: true,
            color: COLOR.navy,
            width: availableWidth,
            wrapAt: value.length
        });
    });
};

const addFooter = (page, left = 'Generated by the University Scholarship Portal') => {
    line(page, CONTENT_X, 38, CONTENT_X + CONTENT_WIDTH, 38, COLOR.border, 0.5);
    text(page, left, CONTENT_X, 25, { size: 7.1, color: COLOR.muted });
    text(page, 'Keep this copy for your records', CONTENT_X + CONTENT_WIDTH - 150, 25, { size: 7.1, color: COLOR.muted, width: 150, align: 'right' });
};

const createFormPdf = (pageOrPages, options = {}) => {
    const pages = Array.isArray(pageOrPages?.[0]) ? pageOrPages : [pageOrPages];
    return createPdf(pages, { ...options, absolutePages: true });
};

module.exports = {
    COLOR,
    CONTENT_X,
    CONTENT_WIDTH,
    addDocumentTitle,
    addFooter,
    addFullRow,
    addHeader,
    addMetadataStrip,
    addApprovalStamp,
    addPairRow,
    addSection,
    createFormPdf,
    line,
    rect,
    text,
    valueText
};
