const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
const ECI_GATEWAY = 'https://gateway-voters.eci.gov.in';
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

const normalize = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();

const readCached = (key) => {
    const cached = cache.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
        cache.delete(key);
        return undefined;
    }
    return cached.value;
};

const writeCached = (key, value) => {
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
};

const eciHeaders = (stateCode) => ({
    applicationName: 'VSP',
    'PLATFORM-TYPE': 'WEB',
    channelidobo: 'WEB',
    ...(stateCode ? { state: stateCode } : {})
});

const fetchEciJson = async (path, stateCode) => {
    const response = await fetch(`${ECI_GATEWAY}${path}`, {
        headers: eciHeaders(stateCode),
        signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`ECI returned ${response.status}`);
    const data = await response.json();
    if (data?.status && data.status !== 'Success') throw new Error(data.message || 'ECI lookup failed');
    return data;
};

const getEciState = async (requestedState) => {
    const states = readCached('eci-states') || await fetchEciJson('/api/v1/common/states/');
    writeCached('eci-states', states);
    const requested = normalize(requestedState);
    const aliases = {
        delhi: ['nct of delhi'],
        'dadra and nagar haveli and daman and diu': ['dadra and nagar haveli and daman and diu']
    };
    const matches = new Set([requested, ...(aliases[requested] || [])]);
    return (states || []).find((state) => matches.has(normalize(state.stateName)));
};

const getDistricts = async (stateCode) => {
    const key = `eci-districts:${stateCode}`;
    const cached = readCached(key);
    if (cached) return cached;
    const response = await fetchEciJson('/api/v1/citizen/sir/getDistrict', stateCode);
    return writeCached(key, response.payload || []);
};

router.use(protect, (req, res, next) => {
    if (req.user?.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Student access is required.' });
    }
    return next();
});

router.get('/eci/districts', async (req, res) => {
    const stateName = String(req.query.state || '').trim().slice(0, 100);
    if (!stateName) return res.json({ success: true, districts: [] });

    try {
        const state = await getEciState(stateName);
        if (!state?.stateCd) return res.json({ success: true, districts: [] });
        const districts = await getDistricts(state.stateCd);
        return res.json({
            success: true,
            districts: districts
                .map((item) => ({ number: item.districtNo, name: String(item.distName || '').trim() }))
                .filter((item) => item.number && item.name)
        });
    } catch (error) {
        console.error('ECI district lookup failed:', error.message);
        return res.status(502).json({ success: false, message: 'ECI district options are temporarily unavailable.' });
    }
});

router.get('/eci/assemblies', async (req, res) => {
    const stateName = String(req.query.state || '').trim().slice(0, 100);
    const districtName = String(req.query.district || '').trim().slice(0, 100);
    if (!stateName || !districtName) return res.json({ success: true, assemblies: [] });

    try {
        const state = await getEciState(stateName);
        if (!state?.stateCd) return res.json({ success: true, assemblies: [] });
        const districts = await getDistricts(state.stateCd);
        const requestedDistrict = normalize(districtName);
        const district = districts.find((item) => normalize(item.distName) === requestedDistrict)
            || districts.find((item) => normalize(item.distName).startsWith(requestedDistrict)
                || requestedDistrict.startsWith(normalize(item.distName)));
        if (!district?.districtNo) return res.json({ success: true, assemblies: [] });

        const cacheKey = `eci-assemblies:${state.stateCd}:${district.districtNo}`;
        const cached = readCached(cacheKey);
        if (cached) return res.json({ success: true, assemblies: cached });
        const response = await fetchEciJson(
            `/api/v1/citizen/sir/getAsmblyByDist?District=${encodeURIComponent(district.districtNo)}`,
            state.stateCd
        );
        const assemblies = (response.payload || [])
            .map((item) => ({ number: item.acNo, name: item.acName }))
            .filter((item) => item.number && item.name);
        return res.json({ success: true, assemblies: writeCached(cacheKey, assemblies) });
    } catch (error) {
        console.error('ECI assembly lookup failed:', error.message);
        return res.status(502).json({ success: false, message: 'ECI constituency options are temporarily unavailable.' });
    }
});

router.get('/eci/parts', async (req, res) => {
    const stateName = String(req.query.state || '').trim().slice(0, 100);
    const assemblyNumber = String(req.query.assembly || '').trim().slice(0, 10);
    if (!stateName || !/^\d+$/.test(assemblyNumber)) return res.json({ success: true, parts: [] });

    try {
        const state = await getEciState(stateName);
        if (!state?.stateCd) return res.json({ success: true, parts: [] });
        const cacheKey = `eci-parts:${state.stateCd}:${assemblyNumber}`;
        const cached = readCached(cacheKey);
        if (cached) return res.json({ success: true, parts: cached });
        const response = await fetchEciJson(
            `/api/v1/citizen/sir/getPartByAc?Asmbly=${encodeURIComponent(assemblyNumber)}`,
            state.stateCd
        );
        const seen = new Set();
        const parts = (response.payload || [])
            .map((item) => ({ number: Number(item.partNumber), name: String(item.partName || '').trim() }))
            .filter((part) => {
                if (!Number.isInteger(part.number) || part.number < 1 || !part.name || seen.has(part.number)) return false;
                seen.add(part.number);
                return true;
            })
            .sort((first, second) => first.number - second.number);
        return res.json({ success: true, parts: writeCached(cacheKey, parts) });
    } catch (error) {
        console.error('ECI polling-part lookup failed:', error.message);
        return res.status(502).json({ success: false, message: 'ECI village/town options are temporarily unavailable.' });
    }
});

module.exports = router;
