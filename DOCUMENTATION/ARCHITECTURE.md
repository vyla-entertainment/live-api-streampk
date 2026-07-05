# Architecture Overview

The server is built as a Node.js application that acts as a resolver + proxy for HLS streams behind streamed.pk and embed.st.

## High‑Level Flow

```
[Client] → GET /api/stream/:source/:id
    │
    ▼
[Resolver] → Determines source type (goat or golf)
    │
    ├─ goat: POST /fetch → GOAT header + encrypted body → lock.wasm (worker) → M3U8 URL
    └─ golf: fetch embedhd → exposestrat → M3U8 URL
    │
    ▼
[Returns JSON with proxied playlist URL]
    │
[Client] → GET /api/m3u8-proxy?url=...
    │
    ▼
[Playlist Proxy] → curl (with Referer/Origin) → if M3U8 → rewrite all URLs → return
    │
[Client] → GET /api/m3u8-proxy?url=... (segments)
    │
    ▼
[Segment Proxy] → curl → strip PNG wrapper → validate TS → return raw MPEG-TS
```

---

## Key Components

### 1. Resolver (`getManifestUrl`)

- **Goat sources** (`admin`, `echo`, etc.)  
  - Encode a protobuf payload (`{source, id, stream}`) and POST to `${EMBED_DOMAIN}/fetch`.  
  - Receive a `goat` header (key) and an encrypted body.  
  - Spawn a **worker thread** (`lock-worker.js`) that loads `lock.wasm` and `lock-esm.mjs`.  
  - The worker mocks a DOM (`happy-dom`) and global `fetch` to satisfy the WASM’s internal requests.  
  - It calls `set_stream_jw(source, id, stream)` and captures the final `.m3u8` URL that the WASM requests.

- **Golf sources**  
  - Fetch the embed page, extract an iframe URL.  
  - Fetch that iframe, extract `fid`.  
  - Fetch `maestrohd1.php` with that `fid`, extract the m3u8 URL from a JavaScript array join.

The resolver returns `{ url, referer }` where `url` is the upstream M3U8 URL and `referer` is an optional override for the proxy.

---

### 2. Playlist Proxy (`proxyPlaylist`)

- Uses **`curl`** (not Node `fetch`) because the CDN (strmd.st) blocks non‑browser User‑Agents and missing referers.
- Applies `Referer` and `Origin` headers from the embed domain.
- Detects M3U8 content by looking for `#EXTM3U`.
- Rewrites every non‑comment line and `URI="…"` attribute to go back through `/api/m3u8-proxy`, preserving the referer.
- Returns the rewritten playlist with correct MIME type and CORS headers.

---

### 3. Segment Proxy (`proxySegment`)

- Fetches the segment via `curl` with the same referer.
- Strips a possible **PNG wrapper** – some CDNs (tiktokcdn) return PNG‑wrapped MPEG‑TS. The function searches for the `IEND` chunk and extracts everything after it.
- Validates that the resulting buffer starts with the TS sync byte `0x47` and is at least 188 bytes long.
- Serves the raw TS data as `video/mp2t`.

---

### 4. Shared Utilities

- **`curlPull`** – wraps `curl` with robust status‑code extraction.
- **`rewriteM3U8`** – handles all URI types (segments, keys, maps) and resolves relative paths against the playlist’s full URL.
- **`stripPng`** – fallback search for `0x47` if PNG signature is missing.

---

## Concurrency & Threading

- The WASM decrypt runs in a **worker thread** because it patches global `fetch` and `WebAssembly.instantiate` – running it on the main thread would interfere with subsequent API calls.
- The main server remains responsive and handles multiple requests concurrently.

---

## Dependencies

- `node-fetch` – for outbound HTTP (used only in resolvers).
- `happy-dom` – to mock a browser DOM for the WASM environment.
- `curl` (system binary) – for proxying upstream HLS content.
- `lock.wasm` / `lock-esm.mjs` – vendor files from the embed.st client.

---

## External Origins

| Origin | Role |
|--------|------|
| `embed.st` | Embed handshake (`/fetch`, `goat` header) |
| `streamed.pk` | Match lookup (if watch URLs are used) |
| `strmd.st` / `tiktokcdn` | CDN for HLS playlists and segments |
| `exposestrat.com` | Golf source relay |

All are configurable via environment variables.