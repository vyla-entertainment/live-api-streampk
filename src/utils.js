const { UPSTREAM } = require('./config');

function badgeUrl(badge) {
    if (!badge) return null;
    return `${UPSTREAM}/images/badge/${badge}.webp`;
}

function toSlug(str) {
    return String(str)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function shapeCard(match) {
    const home = match.teams?.home;
    const away = match.teams?.away;
    const [rawHome, rawAway] = String(match.title || '').split(/ vs\.? /i);

    const homeName = home?.name || rawHome?.trim() || 'TBD';
    const awayName = away?.name || rawAway?.trim() || 'TBD';

    return {
        id: match.id,
        title: match.title,
        category: match.category,
        date: match.date ?? null,
        popular: !!match.popular,
        live: true,
        slug: `${toSlug(match.title)}-${match.id}`,
        teams: {
            home: {
                name: homeName,
                badge: badgeUrl(home?.badge)
            },
            away: {
                name: awayName,
                badge: badgeUrl(away?.badge)
            }
        },
        poster: match.poster ? `${UPSTREAM}/images/proxy/${match.poster}.webp` : null,
        sources: (match.sources || []).map(s => ({ source: s.source, id: s.id })),
        links: {
            self: `/api/${toSlug(match.category)}/${match.id}`,
            streams: (match.sources || []).map(s => `/api/stream/${s.source}/${s.id}`)
        }
    };
}

function absUri(uri, base) {
  return uri.startsWith('http') ? uri : new URL(uri, base).href;
}

function rewriteM3U8(text, baseUrl, proxyBase) {
  const lines = text.split('\n');
  const rewritten = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          const absolute = absUri(uri, baseUrl);
          return `URI="${proxyBase}${encodeURIComponent(absolute)}"`;
        });
      }
      return line;
    }

    const absolute = absUri(trimmed, baseUrl);
    return `${proxyBase}${encodeURIComponent(absolute)}`;
  });

  return rewritten.join('\n');
}

module.exports = { badgeUrl, toSlug, shapeCard, rewriteM3U8 };