const fs = require('fs');
const path = require('path');
const { gunzipSync } = require('zlib');

const DATA_PATH = path.join(__dirname, '..', 'data', 'post-offices.json.gz');

const normalise = (value) => String(value || '').trim().toLocaleLowerCase('en-IN');

const STATE_ALIASES = new Map([
    ['andaman and nicobar islands', 'andaman & nicobar islands'],
    ['dadra and nagar haveli and daman and diu', 'dadra & nagar haveli and daman & diu'],
    ['jammu and kashmir', 'jammu kashmir'],
    ['chhattisgarh', 'chattisgarh'],
    ['tamil nadu', 'tamilnadu']
]);

const matchesState = (state, pin, circle) => {
    const prefix = pin.slice(0, 3);
    const circleName = normalise(circle);
    const dadraDiuPins = ['39621', '39622', '39623', '39624', '36252'];
    const lakshadweep = pin.startsWith('68255');
    const puducherry = /^60500[1-9]$|^60501[0-4]$|^60510[1-9]$|^605110$|^60960[2-9]$|^673310$|^533464$/.test(pin);
    const byPrefix = {
        'andaman and nicobar islands': prefix === '744',
        goa: prefix === '403',
        'dadra and nagar haveli and daman and diu': dadraDiuPins.some((part) => pin.startsWith(part)),
        chandigarh: prefix === '160',
        'jammu and kashmir': circleName === 'jammu kashmir' && prefix !== '194',
        ladakh: circleName === 'jammu kashmir' && prefix === '194',
        lakshadweep: circleName === 'kerala' && lakshadweep,
        puducherry: puducherry,
        'arunachal pradesh': circleName === 'north eastern' && ['790', '791', '792'].includes(prefix),
        manipur: circleName === 'north eastern' && prefix === '795',
        meghalaya: circleName === 'north eastern' && ['793', '794'].includes(prefix),
        mizoram: circleName === 'north eastern' && prefix === '796',
        nagaland: circleName === 'north eastern' && ['797', '798'].includes(prefix),
        sikkim: ['north eastern', 'west bengal'].includes(circleName) && prefix === '737',
        tripura: circleName === 'north eastern' && prefix === '799'
    };
    if (Object.prototype.hasOwnProperty.call(byPrefix, normalise(state))) return byPrefix[normalise(state)];

    const expectedCircle = STATE_ALIASES.get(normalise(state)) || normalise(state);
    if (circleName !== expectedCircle) return false;
    // These prefixes are served through another state's postal circle.
    const reassignedPrefixes = {
        'West Bengal': ['744', '737'], Maharashtra: ['403'],
        Punjab: ['160'], Haryana: ['160'], 'Jammu and Kashmir': ['194'],
        Kerala: [], 'Tamil Nadu': []
    };
    if (state === 'Gujarat' && dadraDiuPins.some((part) => pin.startsWith(part))) return false;
    if (state === 'Kerala' && lakshadweep) return false;
    if (state === 'Tamil Nadu' && puducherry) return false;
    return !(reassignedPrefixes[state] || []).includes(prefix);
};

let postOffices;

const getPostOffices = () => {
    if (postOffices) return postOffices;
    if (!fs.existsSync(DATA_PATH)) throw new Error('Post office directory data is not installed.');
    postOffices = JSON.parse(gunzipSync(fs.readFileSync(DATA_PATH)).toString('utf8'));
    return postOffices;
};

const searchPostOffices = (req, res) => {
    const state = String(req.query.state || '').trim();
    const query = String(req.query.q || '').trim().slice(0, 80);
    if (!state || query.length < 2) {
        return res.status(400).json({ success: false, message: 'Choose a state and enter at least two search characters.' });
    }

    const needle = normalise(query);
    try {
        const matches = getPostOffices()
            .filter(([name, pin, , circle]) => {
                return matchesState(state, pin, circle) && (normalise(name).includes(needle) || pin.includes(query));
            })
            .sort(([name, pin], [otherName, otherPin]) => {
                const a = normalise(name);
                const b = normalise(otherName);
                return Number(!a.startsWith(needle)) - Number(!b.startsWith(needle)) || a.localeCompare(b) || pin.localeCompare(otherPin);
            })
            .slice(0, 25)
            .map(([name, pinCode, officeType]) => ({ name, pinCode, officeType }));
        return res.json({ success: true, offices: matches });
    } catch (error) {
        console.error('Post office directory unavailable:', error.message);
        return res.status(503).json({ success: false, message: 'Post office search is temporarily unavailable. You can enter the office and PIN manually.' });
    }
};

module.exports = { searchPostOffices };
