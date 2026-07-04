const express = require('express');
const { upstreamGet, upstreamPipe } = require('../upstreamClient');
const { getManifestUrl, proxyPlaylist, proxySegment } = require('../streamProxy');
const { shapeCard } = require('../utils');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        name: 'live-api',
        description: 'Live sports aggregator'
    });
});

router.get('/sports', async (req, res) => {
    try {
        const data = await upstreamGet('/sports');
        res.json(data);
    } catch (e) {
        res.status(e.status || 502).json({ error: e.message });
    }
});

router.get('/matches/:category', async (req, res) => {
    try {
        const data = await upstreamGet(`/matches/${req.params.category}`);
        res.json(data.map(shapeCard));
    } catch (e) {
        res.status(e.status || 502).json({ error: e.message });
    }
});

router.get('/matches/:category/popular', async (req, res) => {
    try {
        const data = await upstreamGet(`/matches/${req.params.category}/popular`);
        res.json(data.map(shapeCard));
    } catch (e) {
        res.status(e.status || 502).json({ error: e.message });
    }
});

router.get('/stream/:source/:id', async (req, res) => {
    try {
        const data = await upstreamGet(`/stream/${req.params.source}/${req.params.id}`);
        const proxyBase = `${req.protocol}://${req.get('host')}/api/m3u8-proxy`;
        
        const enriched = await Promise.all(data.map(async (item) => {
            const manifest = await getManifestUrl(item.source, item.id, item.streamNo);
            const streamUrl = manifest ? `${proxyBase}?url=${encodeURIComponent(manifest)}` : null;
            
            return {
                id: item.id,
                streamNo: item.streamNo,
                language: item.language,
                hd: item.hd,
                streamUrl: streamUrl,
                source: item.source,
                viewers: item.viewers
            };
        }));
        
        res.json(enriched);
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

router.get('/m3u8-proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).end();
    if (url.includes('.ts') || url.includes('.m4s') || url.includes('.mp4') || url.includes('.key')) {
        return proxySegment(req, res);
    }
    return proxyPlaylist(req, res);
});

router.get('/images/badge/:badge', async (req, res) => {
    upstreamPipe(`/images/badge/${req.params.badge}`, res);
});

router.get('/images/poster/:badge1/:badge2', async (req, res) => {
    upstreamPipe(`/images/poster/${req.params.badge1}/${req.params.badge2}`, res);
});

router.get(/^\/images\/proxy\/(.+)$/, async (req, res) => {
    upstreamPipe(`/images/proxy/${req.params[0]}`, res);
});

module.exports = router;