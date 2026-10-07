const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
const DNT_SITE = 'https://dwbdnc.dosje.gov.in';
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

const normalize = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();

const decodeHtml = (value) => String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

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

const getStateCode = async (requestedState) => {
    const cached = readCached('dnt-state-options');
    let states = cached;
    if (!states) {
        const response = await fetch(`${DNT_SITE}/register_new/livelihood`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`DNT board returned ${response.status}`);
        const html = await response.text();
        const options = [...html.matchAll(/<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/gi)]
            .map((match) => ({ code: match[1], name: decodeHtml(match[2]) }))
            .filter((state) => state.name && !/district|category|community|select/i.test(state.name));
        states = writeCached('dnt-state-options', options);
    }
    return states.find((state) => normalize(state.name) === normalize(requestedState));
};

router.get('/communities', protect, async (req, res) => {
    if (req.user?.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Student access is required.' });
    }

    const stateName = String(req.query.state || '').trim().slice(0, 100);
    if (!stateName) return res.json({ success: true, communities: [] });

    try {
        const state = await getStateCode(stateName);
        if (!state) return res.json({ success: true, communities: [] });
        const key = `dnt-communities:${state.code}`;
        const cached = readCached(key);
        if (cached) return res.json({ success: true, communities: cached });

        // Category 1 is DNT in the DWBDNC community selector.
        const response = await fetch(`${DNT_SITE}/getComm_new/${encodeURIComponent(state.code)}/1`, {
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`DNT community lookup returned ${response.status}`);
        const data = await response.json();
        const seen = new Set();
        const communities = Object.values(data || {})
            .flat()
            .map((entry) => String(entry?.community_name || '').trim())
            .filter((name) => {
                const key = normalize(name);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        return res.json({ success: true, state: state.name, communities: writeCached(key, communities) });
    } catch (error) {
        console.error('DNT community lookup failed:', error.message);
        return res.status(502).json({ success: false, message: 'DNT community options are temporarily unavailable.' });
    }
});

module.exports = router;
