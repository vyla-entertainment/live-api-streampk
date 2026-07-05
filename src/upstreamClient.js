const fetch = require('node-fetch');
const { UPSTREAM, CACHE_TTL, UPSTREAM_TIMEOUT } = require('./config');

const cache = new Map();

async function upstreamGet(pathname) {
    const cached = cache.get(pathname);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

    try {
        const res = await fetch(`${UPSTREAM}${pathname}`, {
            headers: { 'User-Agent': 'live-api/1.0' },
            signal: controller.signal
        });

        if (!res.ok) {
            const err = new Error(`Upstream error ${res.status}`);
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        cache.set(pathname, { data, time: Date.now() });
        return data;
    } catch (e) {
        if (e.name === 'AbortError') {
            const err = new Error('Upstream request timed out');
            err.status = 504;
            throw err;
        }
        throw e;
    } finally {
        clearTimeout(timeout);
    }
}

async function upstreamPipe(pathname, res) {
    try {
        const response = await fetch(`${UPSTREAM}${pathname}`, {
            headers: { 'User-Agent': 'live-api/1.0' },
        });
        if (!response.ok) {
            return res.status(response.status).end();
        }
        res.set('Content-Type', response.headers.get('content-type'));
        res.set('Cache-Control', 'public, max-age=86400');
        response.body.pipe(res);
    } catch (e) {
        res.status(502).end();
    }
}

module.exports = { upstreamGet, upstreamPipe };