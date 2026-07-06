const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { EMBED_DOMAIN } = require('./config');
const fetch = require('node-fetch');

const { resolveGolf } = require('./resolvers/golf');
const { resolveGoat } = require('./resolvers/goat');

const exec = promisify(execFile);
const UA = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DEBUG = process.env.DEBUG === 'true';
function debugLog(...args) {
  if (DEBUG) console.error('[streamProxy]', ...args);
}

function absUri(uri, base) {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  try {
    return new URL(uri, base).href;
  } catch {
    return uri;
  }
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

async function curlPull(url, referer) {
  const args = [
    '-sS', '-L',
    '-H', `User-Agent: ${UA}`,
    '-H', `Referer: ${referer}`,
    '-H', `Origin: ${new URL(referer).origin}`,
    '-H', `Accept: */*`,
    '-H', `Accept-Language: en-US,en;q=0.9`,
    '-H', `Accept-Encoding: gzip, deflate, br`,
    '-H', `Connection: keep-alive`,
    '-H', `Sec-Fetch-Dest: empty`,
    '-H', `Sec-Fetch-Mode: cors`,
    '-H', `Sec-Fetch-Site: cross-site`,
    '-H', `Sec-Ch-Ua: "Google Chrome";v="122", "Chromium";v="122", "Not.A/Brand";v="24"`,
    '-H', `Sec-Ch-Ua-Mobile: ?0`,
    '-H', `Sec-Ch-Ua-Platform: "Windows"`,
    '-H', `DNT: 1`,
    '--compressed',
    '--retry', '3',
    '--retry-delay', '2',
    '-o', '-',
    '-w', 'HTTPSTATUS:%{http_code}',
    url
  ];

  try {
    const { stdout } = await exec('curl', args, { maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' });

    const mark = stdout.lastIndexOf(Buffer.from('HTTPSTATUS:'));
    if (mark < 0) throw new Error('curl response parse failed');

    const body = stdout.subarray(0, mark);
    const code = Number(stdout.subarray(mark + 11).toString('utf8'));

    if (code < 200 || code >= 300) {
      const err = new Error(`Upstream rejected with status ${code}`);
      err.status = code;
      throw err;
    }

    return body;
  } catch (curlError) {
    debugLog('curl failed, trying node-fetch fallback:', curlError.message);
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Referer': referer,
        'Origin': new URL(referer).origin,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'DNT': '1'
      },
      timeout: 8000
    });

    if (!response.ok) {
      const err = new Error(`Upstream rejected with status ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const buffer = await response.buffer();
    return buffer;
  }
}

async function getManifestUrl(source, id, streamNo) {
  try {
    if (source === 'golf') {
      return await resolveGolf(source, id, streamNo);
    } else {
      return await resolveGoat(source, id, streamNo);
    }
  } catch (e) {
    console.error(`Resolver error for ${source}:`, e);
    return null;
  }
}

function parseSlot(query) {
  const embed = query.embed;
  const embedOrigin = query.embedOrigin;
  const referer = query.referer;

  if (embed && embedOrigin) {
    return {
      origin: embedOrigin,
      path: embed,
      referer: `${embedOrigin}/embed/${embed}`
    };
  }

  if (referer) {
    try {
      const url = new URL(referer);
      const pathMatch = referer.match(/\/embed\/(.+)$/);
      if (pathMatch) {
        return {
          origin: url.origin,
          path: pathMatch[1],
          referer: referer
        };
      }
    } catch { }
    return { referer };
  }

  return { referer: `${EMBED_DOMAIN}/` };
}

async function proxyPlaylist(req, res) {
  try {
    const slot = parseSlot(req.query);
    const { url } = req.query;
    if (!url) {
      debugLog('Missing url parameter');
      return res.status(400).end();
    }

    const ref = slot.referer || `${EMBED_DOMAIN}/`;
    debugLog(`Fetching playlist: ${url} with referer ${ref}`);
    const bodyBuffer = await curlPull(url, ref);
    const content = bodyBuffer.toString('utf8');

    const urlObj = new URL(url);
    const baseUrl = urlObj.href;
    const proxyBase = `${req.protocol}://${req.get('host')}/api/m3u8-proxy?`;

    const params = new URLSearchParams();
    if (slot.origin && slot.path) {
      params.set('embed', slot.path);
      params.set('embedOrigin', slot.origin);
    } else if (req.query.referer) {
      params.set('referer', req.query.referer);
    }
    const queryString = params.toString();
    const proxyWithParams = queryString ? `${proxyBase}${queryString}&url=` : `${proxyBase}url=`;

    const rewritten = rewriteM3U8(content, baseUrl, proxyWithParams);

    if (DEBUG) {
      debugLog('Rewritten playlist (first 500 chars):');
      debugLog(rewritten.slice(0, 500));
    }

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.send(rewritten);
  } catch (e) {
    console.error('Playlist error:', e.message);
    if (DEBUG) console.error(e.stack);
    res.status(e.status || 502).end();
  }
}

function stripPng(buf) {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    const iend = buf.indexOf(Buffer.from('IEND'));
    if (iend >= 0 && iend + 8 < buf.length) {
      return buf.subarray(iend + 8);
    }
  }
  for (let i = 0; i < Math.min(buf.length, 65536); i++) {
    if (buf[i] === 0x47 && i + 188 < buf.length && buf[i + 188] === 0x47) {
      return buf.subarray(i);
    }
  }
  return buf;
}

async function proxySegment(req, res) {
  try {
    const slot = parseSlot(req.query);
    const { url } = req.query;
    if (!url) {
      debugLog('Missing url parameter for segment');
      return res.status(400).end();
    }

    const ref = slot.referer || `${EMBED_DOMAIN}/`;
    debugLog(`Fetching segment: ${url} with referer ${ref}`);
    const buffer = await curlPull(url, ref);

    debugLog(`Segment buffer size: ${buffer.length}, first 10 bytes: ${buffer.subarray(0, 10).toString('hex')}`);

    const strippedBuffer = stripPng(buffer);

    debugLog(`Stripped buffer size: ${strippedBuffer.length}, first 10 bytes: ${strippedBuffer.subarray(0, 10).toString('hex')}`);

    if (strippedBuffer.length < 188 || strippedBuffer[0] !== 0x47) {
      debugLog('Invalid TS segment - first 200 chars:', buffer.toString('utf8', 0, 200));
      throw new Error('Invalid TS segment – missing sync byte');
    }

    res.set('Content-Type', 'video/mp2t');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Accept-Ranges', 'bytes');
    res.send(strippedBuffer);
  } catch (e) {
    console.error('Segment error:', e.message);
    if (DEBUG) console.error(e.stack);
    res.status(e.status || 502).end();
  }
}

module.exports = { getManifestUrl, proxyPlaylist, proxySegment };