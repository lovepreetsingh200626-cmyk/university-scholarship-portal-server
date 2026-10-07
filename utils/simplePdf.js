const zlib = require('zlib');

const escapePdfText = (value) => String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const wrapText = (value, limit = 88) => {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (let word of words) {
        while (word.length > limit) {
            if (line) {
                lines.push(line);
                line = '';
            }
            lines.push(word.slice(0, limit));
            word = word.slice(limit);
        }
        if (line && `${line} ${word}`.length > limit) {
            lines.push(line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    if (line) lines.push(line);
    return lines;
};

const pdfColor = (value = '#172033') => {
    let hex = String(value).replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map((digit) => digit + digit).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) hex = '172033';
    return [0, 2, 4]
        .map((offset) => (parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(3))
        .join(' ');
};

const buildPageContent = (items, images) => {
    const commands = [];
    let y = 790;
    for (const item of items) {
        if (item.shape === 'rect') {
            if (item.fill) {
                commands.push(`q ${pdfColor(item.fill)} rg ${item.x} ${item.y} ${item.width} ${item.height} re f Q`);
            }
            if (item.stroke) {
                commands.push(`q ${pdfColor(item.stroke)} RG ${item.lineWidth || 0.6} w ${item.x} ${item.y} ${item.width} ${item.height} re S Q`);
            }
            continue;
        }
        if (item.shape === 'line') {
            commands.push(`q ${pdfColor(item.color)} RG ${item.lineWidth || 0.6} w ${item.x1} ${item.y1} m ${item.x2} ${item.y2} l S Q`);
            continue;
        }
        if (item.shape === 'circle') {
            const radius = item.radius;
            const k = radius * 0.5522847498;
            const path = `${item.cx + radius} ${item.cy} m ${item.cx + radius} ${item.cy + k} ${item.cx + k} ${item.cy + radius} ${item.cx} ${item.cy + radius} c ${item.cx - k} ${item.cy + radius} ${item.cx - radius} ${item.cy + k} ${item.cx - radius} ${item.cy} c ${item.cx - radius} ${item.cy - k} ${item.cx - k} ${item.cy - radius} ${item.cx} ${item.cy - radius} c ${item.cx + k} ${item.cy - radius} ${item.cx + radius} ${item.cy - k} ${item.cx + radius} ${item.cy} c h`;
            if (item.fill && item.stroke) commands.push(`q ${pdfColor(item.fill)} rg ${pdfColor(item.stroke)} RG ${item.lineWidth || 0.8} w ${path} B Q`);
            else if (item.fill) commands.push(`q ${pdfColor(item.fill)} rg ${path} f Q`);
            else if (item.stroke) commands.push(`q ${pdfColor(item.stroke)} RG ${item.lineWidth || 0.8} w ${path} S Q`);
            continue;
        }        if (item.image) {
            const image = images[item.imageKey || 'primary'];
            if (!image) continue;
            commands.push(`q ${item.width} 0 0 ${item.height} ${item.x} ${item.y} cm /${image.resourceName} Do Q`);
            continue;
        }
        const size = item.size || 10;
        if (Number.isFinite(item.x) && Number.isFinite(item.y)) {
            const wrapAt = item.wrapAt || (item.width ? Math.max(1, Math.floor(item.width / (size * 0.53))) : (size >= 15 ? 62 : 92));
            let textY = item.y;
            for (const text of wrapText(item.text, wrapAt)) {
                const estimatedWidth = text.length * size * 0.52;
                let textX = item.x;
                if (item.align === 'center' && item.width) textX += Math.max(0, (item.width - estimatedWidth) / 2);
                if (item.align === 'right' && item.width) textX += Math.max(0, item.width - estimatedWidth);
                const font = item.font === 'serif' ? (item.bold ? 'F4' : 'F3') : (item.bold ? 'F2' : 'F1');
                commands.push(`BT /${font} ${size} Tf ${pdfColor(item.color)} rg ${textX} ${textY} Td (${escapePdfText(text)}) Tj ET`);
                textY -= item.leading || (size >= 15 ? 22 : 12);
            }
            continue;
        }
        if (item.spaceBefore) y -= item.spaceBefore;
        for (const text of wrapText(item.text, item.wrapAt || (size >= 15 ? 62 : 92))) {
            if (y < 48) break;
            const font = item.font === 'serif' ? (item.bold ? 'F4' : 'F3') : (item.bold ? 'F2' : 'F1');
            commands.push(`BT /${font} ${size} Tf 48 ${y} Td (${escapePdfText(text)}) Tj ET`);
            y -= item.leading || (size >= 15 ? 22 : 15);
        }
    }
    return commands.join('\n');
};

const paethPredictor = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
};

const decodePngPhoto = (data) => {
    if (!Buffer.isBuffer(data) || data.length < 33 || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    let palette = null;
    let paletteAlpha = null;
    const idat = [];

    while (offset + 12 <= data.length) {
        const length = data.readUInt32BE(offset);
        if (offset + length + 12 > data.length) return null;
        const type = data.toString('ascii', offset + 4, offset + 8);
        const chunk = data.subarray(offset + 8, offset + 8 + length);
        if (type === 'IHDR') {
            width = chunk.readUInt32BE(0);
            height = chunk.readUInt32BE(4);
            bitDepth = chunk[8];
            colorType = chunk[9];
            interlace = chunk[12];
        } else if (type === 'IDAT') {
            idat.push(chunk);
        } else if (type === 'PLTE') {
            palette = chunk;
        } else if (type === 'tRNS') {
            paletteAlpha = chunk;
        } else if (type === 'IEND') {
            break;
        }
        offset += length + 12;
    }

    if (!width || !height || width * height > 8000000 || bitDepth !== 8 || ![0, 2, 3, 4, 6].includes(colorType) || interlace !== 0 || !idat.length) return null;
    if (colorType === 3 && (!palette || palette.length < 3 || palette.length % 3 !== 0)) return null;
    const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[colorType];
    const rowLength = width * channels;
    const decoded = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: height * (rowLength + 1) });
    if (decoded.length < height * (rowLength + 1)) return null;
    const rgb = Buffer.alloc(width * height * 3);
    let sourceOffset = 0;
    let previous = Buffer.alloc(rowLength);

    for (let y = 0; y < height; y += 1) {
        const filter = decoded[sourceOffset];
        sourceOffset += 1;
        const row = Buffer.from(decoded.subarray(sourceOffset, sourceOffset + rowLength));
        sourceOffset += rowLength;
        for (let index = 0; index < rowLength; index += 1) {
            const left = index >= channels ? row[index - channels] : 0;
            const up = previous[index] || 0;
            const upperLeft = index >= channels ? (previous[index - channels] || 0) : 0;
            if (filter === 1) row[index] = (row[index] + left) & 255;
            else if (filter === 2) row[index] = (row[index] + up) & 255;
            else if (filter === 3) row[index] = (row[index] + Math.floor((left + up) / 2)) & 255;
            else if (filter === 4) row[index] = (row[index] + paethPredictor(left, up, upperLeft)) & 255;
            else if (filter !== 0) return null;
        }

        for (let x = 0; x < width; x += 1) {
            const source = x * channels;
            const target = (y * width + x) * 3;
            let red;
            let green;
            let blue;
            let alpha = 255;
            if (colorType === 0) {
                red = green = blue = row[source];
            } else if (colorType === 2) {
                red = row[source];
                green = row[source + 1];
                blue = row[source + 2];
            } else if (colorType === 3) {
                const paletteIndex = row[source];
                if (paletteIndex * 3 + 2 >= palette.length) return null;
                red = palette[paletteIndex * 3];
                green = palette[paletteIndex * 3 + 1];
                blue = palette[paletteIndex * 3 + 2];
                alpha = paletteAlpha?.[paletteIndex] ?? 255;
            } else if (colorType === 4) {
                red = green = blue = row[source];
                alpha = row[source + 1];
            } else {
                red = row[source];
                green = row[source + 1];
                blue = row[source + 2];
                alpha = row[source + 3];
            }
            rgb[target] = Math.round((red * alpha + 255 * (255 - alpha)) / 255);
            rgb[target + 1] = Math.round((green * alpha + 255 * (255 - alpha)) / 255);
            rgb[target + 2] = Math.round((blue * alpha + 255 * (255 - alpha)) / 255);
        }
        previous = row;
    }

    return { data: zlib.deflateSync(rgb), width, height, filter: 'FlateDecode' };
};

const jpegDimensions = (data) => {
    if (!Buffer.isBuffer(data) || data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 9 < data.length) {
        if (data[offset] !== 0xff) return null;
        const marker = data[offset + 1];
        offset += 2;
        if ([0xd8, 0xd9, 0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7].includes(marker)) continue;
        if (offset + 2 > data.length) return null;
        const segmentLength = data.readUInt16BE(offset);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
            const height = data.readUInt16BE(offset + 3);
            const width = data.readUInt16BE(offset + 5);
            return width && height ? { data, width, height, filter: 'DCTDecode' } : null;
        }
        offset += segmentLength;
    }
    return null;
};

const preparePdfImage = (image) => {
    if (!image?.data) return null;
    if (image.type === 'image/jpeg' || image.type === 'image/jpg') return jpegDimensions(image.data);
    if (image.type === 'image/png') return decodePngPhoto(image.data);
    return null;
};

const createPdf = (sections, options = {}) => {
    const images = {};
    if (options.image) images.primary = options.image;
    for (const [key, image] of Object.entries(options.images || {})) images[key] = image;
    const preparedImages = Object.fromEntries(
        Object.entries(images)
            .map(([key, image]) => [key, preparePdfImage(image)])
            .filter(([, image]) => Boolean(image))
            .map(([key, image], index) => [key, { ...image, resourceName: `Im${index + 1}` }])
    );
    let pages = [];
    if (options.absolutePages) {
        pages = sections.map((items) => Array.isArray(items) ? items : [items]);
    } else {
        let page = [];
        let lineCount = 0;
        for (const section of sections) {
            if (section.pageBreak && page.length) {
                pages.push(page);
                page = [];
                lineCount = 0;
            }
            const items = Array.isArray(section) ? section : [section];
            for (const item of items) {
                const estimated = Math.max(1, Math.ceil(String(item.text || '').length / (item.wrapAt || 88)));
                if (lineCount + estimated > 47 && page.length) {
                    pages.push(page);
                    page = [];
                    lineCount = 0;
                }
                page.push(item);
                lineCount += estimated + (item.spaceBefore ? 1 : 0);
            }
        }
        if (page.length) pages.push(page);
    }
    if (!pages.length) pages.push([{ text: 'Scholarship Portal', bold: true, size: 18 }]);

    const objects = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    const pageRefs = pages.map((_, index) => `${5 + index * 2} 0 R`).join(' ');
    objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

    let nextObjectId = 5 + pages.length * 2;
    const serifFontId = nextObjectId++;
    const serifBoldFontId = nextObjectId++;
    const imageObjectIds = Object.fromEntries(Object.keys(preparedImages).map((key) => [key, nextObjectId++]));
    objects[serifFontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>';
    objects[serifBoldFontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>';

    pages.forEach((pageItems, index) => {
        const pageId = 5 + index * 2;
        const contentId = pageId + 1;
        const stream = buildPageContent(pageItems, preparedImages);
        const streamLength = Buffer.byteLength(stream, 'latin1');
        const xObjectResource = Object.keys(preparedImages).length
            ? ` /XObject << ${Object.entries(imageObjectIds).map(([key, objectId]) => `/${preparedImages[key].resourceName} ${objectId} 0 R`).join(' ')} >>`
            : '';
        objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 ${serifFontId} 0 R /F4 ${serifBoldFontId} 0 R >>${xObjectResource} >> /Contents ${contentId} 0 R >>`;
        objects[contentId] = `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`;
    });

    for (const [key, image] of Object.entries(preparedImages)) {
        const imageObjectId = imageObjectIds[key];
        const streamLength = image.data.length;
        const decodeParams = image.filter === 'FlateDecode'
            ? ` /DecodeParms << /Predictor 1 >>`
            : '';
        objects[imageObjectId] = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter}${decodeParams} /Length ${streamLength} >>\nstream\n${image.data.toString('latin1')}\nendstream`;
    }

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
        offsets[id] = Buffer.byteLength(pdf, 'latin1');
        pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
        pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
};

module.exports = { createPdf };
