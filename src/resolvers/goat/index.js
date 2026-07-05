const { encodeBody } = require('./proto');
const { postFetch } = require('./fetch');
const { unlock } = require('./lock');
const { EMBED_DOMAIN } = require('../../config');

async function resolveGoat(source, id, stream) {
    const slot = { source, id, stream: String(stream), path: `${source}/${id}/${stream}` };
    const { body, goat } = await postFetch(encodeBody(slot), slot.path);
    const m3u8 = await unlock(slot, goat, body);
    return {
        url: m3u8,
        referer: `${EMBED_DOMAIN}/embed/${slot.path}`
    };
}

module.exports = { resolveGoat };