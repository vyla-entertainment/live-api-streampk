const fetch = require('node-fetch');
const { EMBED_DOMAIN } = require('../config');

const relayReferer = 'https://exposestrat.com/';

function iframeUrl(html) {
    const m = html.match(/iframe src="([^"]+)"/);
    if (!m) throw new Error('golf embed iframe not found');
    return m[1].replace(/&amp;/g, '&');
}

function fid(html) {
    const m = html.match(/fid="([^"]+)"/);
    if (!m) throw new Error('golf stream fid not found');
    return m[1];
}

function m3u8Url(html) {
    const m = html.match(/return\(\[("[^"]+"(?:,"[^"]+")*)\]\.join\(""\)/);
    if (!m) throw new Error('golf m3u8 url not found');
    return JSON.parse(`[${m[1]}]`).join('');
}

async function resolveGolf(source, id, stream) {
    const embedUrl = `${EMBED_DOMAIN}/embed/${source}/${id}/${stream}`;
    const baseHeaders = { 'User-Agent': 'Mozilla/5.0' };

    const embedHtml = await (await fetch(embedUrl, { headers: { ...baseHeaders, Referer: `${EMBED_DOMAIN}/` } })).text();
    const streamedUrl = iframeUrl(embedHtml);
    const streamedHtml = await (await fetch(streamedUrl, { headers: { ...baseHeaders, Referer: embedUrl } })).text();

    const live = fid(streamedHtml);
    const playerUrl = `https://exposestrat.com/maestrohd1.php?player=desktop&live=${encodeURIComponent(live)}`;
    const playerHtml = await (await fetch(playerUrl, { headers: { ...baseHeaders, Referer: streamedUrl } })).text();

    return {
        url: m3u8Url(playerHtml),
        referer: relayReferer
    };
}

module.exports = { resolveGolf };