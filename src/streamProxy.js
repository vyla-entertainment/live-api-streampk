const fetch = require('node-fetch');
const { EMBED_DOMAIN } = require('./config');
const { rewriteM3U8 } = require('./utils');

async function getManifestUrl(source, id, streamNo) {
    const referer = `${EMBED_DOMAIN}/embed/${source}/${id}/${streamNo}`;
    const baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': EMBED_DOMAIN,
        'Referer': referer
    };

    let cookies = [];

    try {
        const pageRes = await fetch(referer, {
            headers: {
                ...baseHeaders,
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none'
            }
        });
        
        let html = await pageRes.text();
        html = html.replace(/\\\//g, '/');

        const setCookiePage = pageRes.headers.raw()['set-cookie'];
        if (setCookiePage) cookies.push(...setCookiePage.map(c => c.split(';')[0]));

        let streamUrl = null;
        
        const urlMatches = html.match(/https?:\/\/[a-zA-Z0-9_.\-\/]+\.m3u8[^"'\s<>\\}]*/gi);
        if (urlMatches) {
            for (const u of urlMatches) {
                if (u.includes('lb8') || u.includes('.strmd.st') || u.includes('/secure/')) {
                    streamUrl = u;
                    break;
                }
            }
            if (!streamUrl) streamUrl = urlMatches[0];
        }

        if (!streamUrl) {
            const b64Regex = /['"]([A-Za-z0-9+/=]{30,})['"]/g;
            let match;
            while ((match = b64Regex.exec(html)) !== null) {
                try {
                    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
                    if (decoded.includes('.m3u8')) {
                        const m = decoded.match(/(https?:\/\/[^\s"'<>]+)/i);
                        if (m) {
                            streamUrl = m[1];
                            break;
                        }
                    }
                } catch (e) {}
            }
        }

        if (streamUrl) {
            if (streamUrl.startsWith('/')) streamUrl = EMBED_DOMAIN + streamUrl;

            try {
                const hs1 = await fetch(`${EMBED_DOMAIN}/fetch`, {
                    method: 'POST',
                    headers: { ...baseHeaders, 'Content-Type': 'text/plain', 'Cookie': cookies.join('; ') },
                    body: 'A'.repeat(128)
                });
                const sc1 = hs1.headers.raw()['set-cookie'];
                if (sc1) cookies.push(...sc1.map(c => c.split(';')[0]));

                const hs2 = await fetch(`${EMBED_DOMAIN}/fetch`, {
                    method: 'POST',
                    headers: { ...baseHeaders, 'Content-Type': 'application/octet-stream', 'Cookie': cookies.join('; ') },
                    body: Buffer.alloc(55)
                });
                const sc2 = hs2.headers.raw()['set-cookie'];
                if (sc2) cookies.push(...sc2.map(c => c.split(';')[0]));

                const goatToken = hs2.headers.get('goat');
                if (goatToken) {
                    const separator = streamUrl.includes('?') ? '&' : '?';
                    streamUrl += `${separator}goat=${goatToken}`;
                }
            } catch (err) {
            }

            return streamUrl;
        }

        return null;
    } catch (e) {
        return null;
    }
}

async function proxyPlaylist(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).end();

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
                'Referer': EMBED_DOMAIN,
                'Origin': EMBED_DOMAIN
            }
        });

        if (!response.ok) return res.status(response.status).end();

        const content = await response.text();
        const urlObj = new URL(url);
        const origin = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);

        const proxyBase = `${req.protocol}://${req.get('host')}/api/m3u8-proxy`;
        const rewritten = rewriteM3U8(content, origin, proxyBase);

        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.set('Access-Control-Allow-Origin', '*');
        res.send(rewritten);
    } catch (e) {
        res.status(502).end();
    }
}

async function proxySegment(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).end();

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
                'Referer': EMBED_DOMAIN,
                'Origin': EMBED_DOMAIN
            }
        });
        if (!response.ok) return res.status(response.status).end();
        res.set('Content-Type', response.headers.get('content-type'));
        res.set('Access-Control-Allow-Origin', '*');
        response.body.pipe(res);
    } catch (e) {
        res.status(502).end();
    }
}

module.exports = { getManifestUrl, proxyPlaylist, proxySegment };