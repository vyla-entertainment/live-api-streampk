const express = require('express');
const { upstreamPost } = require('../upstreamClient');
const { shapeChannel } = require('../utils');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        name: 'live-api',
        description: 'Live IPTV aggregator',
        endpoints: [
            '/api/countries',
            '/api/channels',
            '/api/channels/:country',
            '/api/stream/:id'
        ]
    });
});

router.get('/countries', async (req, res) => {
    try {
        const data = await upstreamPost('/mediaurl-catalog.json', {
            catalogId: 'iptv',
            id: '',
            adult: false,
            search: '',
            sort: 'trending-region',
            filter: {},
            cursor: null
        });
        
        const groupFilter = data.features?.filter?.find(f => f.id === 'group');
        const countries = groupFilter ? groupFilter.values : [];
        res.json(countries);
    } catch (e) {
        res.status(e.status || 502).json({ error: e.message });
    }
});

router.get('/channels', async (req, res) => {
    try {
        const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : null;
        const data = await upstreamPost('/mediaurl-catalog.json', {
            catalogId: 'iptv',
            id: '',
            adult: false,
            search: '',
            sort: 'trending-region',
            filter: {},
            cursor: cursor
        });
        
        res.json({
            channels: (data.items || []).map(shapeChannel),
            nextCursor: data.nextCursor || null
        });
    } catch (e) {
        res.status(e.status || 502).json({ error: e.message });
    }
});

router.get('/channels/:country', async (req, res) => {
    try {
        const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : null;
        const data = await upstreamPost('/mediaurl-catalog.json', {
            catalogId: 'iptv',
            id: '',
            adult: false,
            search: '',
            sort: 'trending-region',
            filter: { group: req.params.country },
            cursor: cursor
        });
        
        res.json({
            channels: (data.items || []).map(shapeChannel),
            nextCursor: data.nextCursor || null
        });
    } catch (e) {
        res.status(e.status || 502).json({ error: e.message });
    }
});

router.get('/stream/:id', async (req, res) => {
    try {
        const playUrl = `https://huhu.to/huhu-iptv/play/${req.params.id}`;
        const data = await upstreamPost('/mediaurl-resolve.json', { url: playUrl });
        
        const streams = (Array.isArray(data) ? data : [data]).map(stream => {
            return {
                id: stream.name || stream.id,
                name: stream.name || stream.id,
                url: stream.url
            };
        });
        
        res.json(streams);
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

module.exports = router;