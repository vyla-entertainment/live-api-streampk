const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { EMBED_DOMAIN } = require('./config');

const { resolveGolf } = require('./resolvers/golf');
const { resolveGoat } = require('./resolvers/goat');

const exec = promisify(execFile);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
    '-sS', '-L', '--compressed',
    '-H', `User-Agent: ${UA}`,
    '-H', `Referer: ${referer}`,
    '-H', `Origin: ${new URL(referer).origin}`,
    '-H', `Accept: */*`,
    '-o', '-',
    '-w', 'HTTPSTATUS:%{http_code}',
    url
  ];

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

async function proxyPlaylist(req, res) {
  const { url, referer } = req.query;
  if (!url) {
    debugLog('Missing url parameter');
    return res.status(400).end();
  }

  try {
    const ref = referer || `${EMBED_DOMAIN}/`;
    debugLog(`Fetching playlist: ${url} with referer ${ref}`);
    const bodyBuffer = await curlPull(url, ref);
    const content = bodyBuffer.toString('utf8');

    const baseUrl = url;
    const proxyBase = `${req.protocol}://${req.get('host')}/api/m3u8-proxy?`;
    const proxyWithReferer = referer 
      ? `${proxyBase}referer=${encodeURIComponent(referer)}&url=` 
      : `${proxyBase}url=`;

    const rewritten = rewriteM3U8(content, baseUrl, proxyWithReferer);

    if (DEBUG) {
      debugLog('Rewritten playlist (first 500 chars):');
      debugLog(rewritten.slice(0, 500));
    }

    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Access-Control-Allow-Origin', '*');
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
  const { url, referer } = req.query;
  if (!url) {
    debugLog('Missing url parameter for segment');
    return res.status(400).end();
  }

  try {
    const ref = referer || `${EMBED_DOMAIN}/`;
    debugLog(`Fetching segment: ${url} with referer ${ref}`);
    const buffer = await curlPull(url, ref);
    
    const strippedBuffer = stripPng(buffer);

    if (strippedBuffer.length < 188 || strippedBuffer[0] !== 0x47) {
      throw new Error('Invalid TS segment – missing sync byte');
    }

    res.set('Content-Type', 'video/mp2t');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(strippedBuffer);
  } catch (e) {
    console.error('Segment error:', e.message);
    if (DEBUG) console.error(e.stack);
    res.status(e.status || 502).end();
  }
}

module.exports = { getManifestUrl, proxyPlaylist, proxySegment };