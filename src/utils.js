const fetch = require('node-fetch');

let logoMap = new Map();

function cleanChannelName(name) {
    if (!name) return '';
    return name
        .replace(/\s*\|.*$/, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\b(HD\+|HD|FHD|UHD|4K|RAW|TV|TR:)\b/gi, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

function cleanChannelNameKeepTv(name) {
    if (!name) return '';
    return name
        .replace(/\s*\|.*$/, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\b(HD\+|HD|FHD|UHD|4K|RAW|TR:)\b/gi, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

async function loadIptvOrgData() {
    try {
        const [channelsRes, logosRes] = await Promise.all([
            fetch('https://iptv-org.github.io/api/channels.json').then(r => r.json()),
            fetch('https://iptv-org.github.io/api/logos.json').then(r => r.json())
        ]);

        const bestLogos = new Map();
        for (const logo of logosRes) {
            if (!bestLogos.has(logo.channel)) {
                bestLogos.set(logo.channel, logo.url);
            }
        }

        const newLogoMap = new Map();
        for (const ch of channelsRes) {
            const logoUrl = bestLogos.get(ch.id);
            if (logoUrl) {
                const clean = cleanChannelName(ch.name);
                if (clean) newLogoMap.set(clean, logoUrl);

                const cleanKeepTv = cleanChannelNameKeepTv(ch.name);
                if (cleanKeepTv) newLogoMap.set(cleanKeepTv, logoUrl);

                if (Array.isArray(ch.alt_names)) {
                    for (const alt of ch.alt_names) {
                        const cleanAlt = cleanChannelName(alt);
                        if (cleanAlt) newLogoMap.set(cleanAlt, logoUrl);

                        const cleanAltKeepTv = cleanChannelNameKeepTv(alt);
                        if (cleanAltKeepTv) newLogoMap.set(cleanAltKeepTv, logoUrl);
                    }
                }
            }
        }
        logoMap = newLogoMap;
    } catch (e) { }
}

loadIptvOrgData();
setInterval(loadIptvOrgData, 24 * 60 * 60 * 1000);

function toSlug(str) {
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function getIptvOrgLogo(name) {
    const clean = cleanChannelName(name);
    if (logoMap.has(clean)) return logoMap.get(clean);

    const cleanKeepTv = cleanChannelNameKeepTv(name);
    if (logoMap.has(cleanKeepTv)) return logoMap.get(cleanKeepTv);

    return null;
}

function shapeChannel(item) {
    const id = item.ids?.id || null;
    const name = item.name || 'Unknown';
    const iptvLogo = getIptvOrgLogo(name);

    return {
        id: id,
        name: name,
        country: item.group || 'Unknown',
        logo: iptvLogo || null,
        slug: `${toSlug(name)}-${id}`,
        links: {
            stream: `/api/stream/${id}`
        }
    };
}

module.exports = { toSlug, shapeChannel };