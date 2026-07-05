const fetch = require('node-fetch');
const { EMBED_DOMAIN } = require('../../config');

async function postFetch(body, path) {
    const referer = `${EMBED_DOMAIN}/embed/${path}`;
    const res = await fetch(`${EMBED_DOMAIN}/fetch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Origin': EMBED_DOMAIN,
            'Referer': referer,
            'User-Agent': 'Mozilla/5.0'
        },
        body
    });

    if (!res.ok) {
        const detail = (await res.text()).trim() || res.statusText;
        throw new Error(`embed /fetch ${res.status}: ${detail}`);
    }

    const goat = res.headers.get('goat');
    if (!goat) throw new Error('missing goat header');

    return { body: Buffer.from(await res.arrayBuffer()), goat };
}

module.exports = { postFetch };