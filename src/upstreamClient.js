const fetch = require('node-fetch');
const { UPSTREAM, CACHE_TTL, UPSTREAM_TIMEOUT } = require('./config');

const cache = new Map();

async function upstreamPost(pathname, body) {
    const cacheKey = pathname + JSON.stringify(body);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

    try {
        const res = await fetch(`${UPSTREAM}${pathname}`, {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
                'Content-Type': 'application/json; charset=utf-8',
                'Referer': `${UPSTREAM}/live`,
                'Origin': UPSTREAM
            },
            body: JSON.stringify({ language: 'de', region: 'DE', ...body }),
            signal: controller.signal
        });

        if (!res.ok) {
            const err = new Error(`Upstream error ${res.status}`);
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        cache.set(cacheKey, { data, time: Date.now() });
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

module.exports = { upstreamPost };