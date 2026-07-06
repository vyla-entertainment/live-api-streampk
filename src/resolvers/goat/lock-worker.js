const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { parentPort, workerData } = require('node:worker_threads');
const { Window } = require('happy-dom');
const { EMBED_DOMAIN } = require('../../config');

const vendorDir = join(__dirname, 'vendor');
const wasmPath = join(vendorDir, 'lock.wasm');
const lockModuleUrl = pathToFileURL(join(vendorDir, 'lock-esm.mjs')).href;

const WASM_URL = 'https://github.com/sharoon7171/streamed-pk-hls-stream-resolver/raw/refs/heads/main/src/sources/goat/vendor/lock.wasm';

async function downloadWasm() {
    if (existsSync(wasmPath)) {
        return readFileSync(wasmPath);
    }
    if (!existsSync(vendorDir)) {
        mkdirSync(vendorDir, { recursive: true });
    }
    const response = await fetch(WASM_URL);
    if (!response.ok) {
        throw new Error(`Failed to download WASM: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(wasmPath, buffer);
    return buffer;
}

let wasmBytes;

function pageUrl(slot) {
    return `${EMBED_DOMAIN}/embed/${slot.path}`;
}

function mountDom(slot) {
    const window = new Window({ url: pageUrl(slot) });
    const doc = window.document;
    doc.body.innerHTML = '<div id="player"></div>';
    const jwCfg = { file: null };
    const jwBase = {
        getContainer: () => doc.getElementById('player'),
        getState: () => 'idle',
        load: (cfg) => { if (cfg?.file) jwCfg.file = cfg.file; },
        setConfig: (cfg) => { if (cfg?.file) jwCfg.file = cfg.file; },
        getConfig: () => jwCfg,
        setup: () => { },
        on: () => { },
        play: () => { },
        getPlaylistItem: () => jwCfg,
        getPlaylist: () => (jwCfg.file ? [{ file: jwCfg.file }] : [])
    };
    window.__wasm_jw_player = new Proxy(jwBase, {
        get(target, prop, receiver) {
            if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);
            if (prop === Symbol.toStringTag) return 'Object';
            return () => null;
        }
    });
    window.jwplayer = () => window.__wasm_jw_player;
    globalThis.window = window;
    globalThis.document = doc;
    globalThis.location = window.location;
    globalThis.self = window;
    globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
    globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
    globalThis.TextDecoder = TextDecoder;
    globalThis.TextEncoder = TextEncoder;
    const NativeRequest = globalThis.Request;
    const NativeResponse = globalThis.Response;
    const NativeHeaders = globalThis.Headers;
    const NativeUrl = globalThis.URL;
    globalThis.URL = class extends NativeUrl {
        constructor(input, base) {
            if (input === '/fetch') input = `${EMBED_DOMAIN}/fetch`;
            super(input, base ?? `${EMBED_DOMAIN}/`);
        }
    };
    globalThis.Request = class extends NativeRequest {
        constructor(input, init) {
            if (input === '/fetch') input = `${EMBED_DOMAIN}/fetch`;
            super(input, init);
        }
    };
    window.URL = globalThis.URL;
    window.Request = globalThis.Request;
    window.Response = NativeResponse;
    window.Headers = NativeHeaders;
    return NativeResponse;
}

function mockFetch(NativeResponse, goat, body, onM3u8) {
    return async (input) => {
        const href = typeof input === 'string' ? input : input?.url ?? String(input);
        if (href.includes('lock.wasm')) {
            return new NativeResponse(wasmBytes, { status: 200, headers: { 'Content-Type': 'application/wasm' } });
        }
        if (href.includes('/fetch')) {
            return new NativeResponse(body, { status: 200, headers: { goat, 'Content-Type': 'application/octet-stream' } });
        }
        if (href.includes('.m3u8')) {
            onM3u8(href);
            return new NativeResponse('#EXTM3U\n#EXT-X-VERSION:3\n', { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } });
        }
        return new NativeResponse('', { status: 404 });
    };
}

function patchImports(imports, NativeResponse, goat, body, onM3u8) {
    const bg = imports?.['./locked_bg.js'];
    if (!bg) return;
    for (const key of Object.keys(bg)) {
        if (!key.includes('instanceof')) continue;
        const orig = bg[key];
        bg[key] = (...args) => (orig(...args) ? 1 : 1);
    }
    const fetchKey = Object.keys(bg).find((k) => k.includes('fetch_e6e8e0'));
    if (!fetchKey) return;
    bg[fetchKey] = (_win, req) => {
        const href = req?.url ?? '';
        if (href.includes('/fetch')) {
            return Promise.resolve(new NativeResponse(body, { status: 200, headers: { goat, 'Content-Type': 'application/octet-stream' } }));
        }
        if (href.includes('.m3u8')) {
            onM3u8(href);
            return Promise.resolve(new NativeResponse('#EXTM3U\n#EXT-X-VERSION:3\n', { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } }));
        }
        return Promise.reject(new Error(`unexpected wasm fetch ${href}`));
    };
}

async function crack(slot, goat, bodyHex) {
    let m3u8 = null;
    const body = Buffer.from(bodyHex, 'hex');
    const NativeResponse = mountDom(slot);
    const fetchFn = mockFetch(NativeResponse, goat, body, (url) => { m3u8 = url; });
    globalThis.fetch = fetchFn;
    const mod = await import(lockModuleUrl);
    const api = await mod.default({
        module_or_path: `${EMBED_DOMAIN}/js/wasm/lock.wasm`,
        fetch: fetchFn
    });
    await api.init_wasm?.();
    try {
        await api.set_stream_jw(slot.source, slot.id, slot.stream);
    } catch (err) {
        if (!m3u8) throw err;
    }
    if (!m3u8) throw new Error('lock did not yield m3u8');
    return m3u8;
}

const { slot, goat, bodyHex } = workerData;

(async () => {
    try {
        if (!wasmBytes) {
            wasmBytes = await downloadWasm();
        }
        const url = await crack(slot, goat, bodyHex);
        parentPort.postMessage({ ok: true, url });
    } catch (err) {
        parentPort.postMessage({ ok: false, error: String(err.message || err) });
    }
})();