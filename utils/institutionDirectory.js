const fs = require('fs');
const path = require('path');
const { gunzipSync } = require('zlib');

const DATA_PATH = path.join(__dirname, '..', 'data', 'institutions.json.gz');

let institutions;

const getInstitutions = () => {
    if (institutions) return institutions;
    if (!fs.existsSync(DATA_PATH)) throw new Error('Institution directory data is not installed.');

    institutions = JSON.parse(gunzipSync(fs.readFileSync(DATA_PATH)).toString('utf8'))
        .map((institution) => ({
            ...institution,
            searchText: `${institution.name} ${institution.id} ${institution.state} ${institution.district} ${institution.type}`.toLocaleLowerCase('en-IN')
        }));
    return institutions;
};

const searchInstitutions = (req, res) => {
    const query = String(req.query.q || '').trim().slice(0, 100).toLocaleLowerCase('en-IN');
    const state = String(req.query.state || '').trim().toLocaleLowerCase('en-IN');
    const district = String(req.query.district || '').trim().toLocaleLowerCase('en-IN');
    const types = new Set(String(req.query.type || '').split(',').map((item) => item.trim().toLocaleLowerCase('en-IN')).filter(Boolean));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = 10;
    if (query.length < 2 && !state && !district) {
        return res.status(400).json({ success: false, message: 'Enter at least two characters or choose a state or district.' });
    }
    try {
        const filteredInstitutions = getInstitutions()
            .filter((institution) => (!state || institution.state.toLocaleLowerCase('en-IN') === state)
                && (!district || institution.district.toLocaleLowerCase('en-IN') === district)
                && (!types.size || types.has(institution.type.toLocaleLowerCase('en-IN')))
                && institution.searchText.includes(query))
            .sort((a, b) => {
                const aName = a.name.toLocaleLowerCase('en-IN');
                const bName = b.name.toLocaleLowerCase('en-IN');
                return Number(!aName.startsWith(query)) - Number(!bName.startsWith(query))
                    || aName.localeCompare(bName, 'en-IN')
                    || a.id.localeCompare(b.id);
            });
        const total = filteredInstitutions.length;
        const matches = filteredInstitutions
            .slice((page - 1) * pageSize, page * pageSize)
            .map(({ searchText, ...institution }) => institution);

        return res.json({
            success: true,
            institutions: matches,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
        });
    } catch (error) {
        console.error('Institution directory unavailable:', error.message);
        return res.status(503).json({ success: false, message: 'Institution search is temporarily unavailable. You can enter the institution name manually.' });
    }
};

module.exports = { searchInstitutions };
