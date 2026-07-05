# Configuration

Configuration lives in `config.js` and controls how the service talks to the upstream provider.

| Constant | Value | Description |
|----------|-------|-------------|
| `UPSTREAM` | `https://huhu.to` | Base URL of the upstream IPTV catalog/resolver provider. |
| `CACHE_TTL` | `30000` (30 seconds) | How long a given upstream response is cached in memory before being refetched. |
| `UPSTREAM_TIMEOUT` | `8000` (8 seconds) | How long to wait for an upstream response before aborting the request and returning a `504`-style error. |

## Caching Behavior

`upstreamClient.js` maintains a simple in-memory cache keyed by the upstream path plus the JSON-serialized request body. This means:

- Identical requests (same endpoint, same filters/cursor) made within `CACHE_TTL` return the cached response without hitting the upstream provider.
- The cache is process-local and in-memory; it is cleared on restart and is not shared across multiple instances of the service.
- There is currently no cache size limit or eviction policy beyond TTL expiry on read.

## Request Headers to Upstream

Every upstream request is sent with:

- A desktop Chrome `User-Agent` string
- `Content-Type: application/json; charset=utf-8`
- `Referer` and `Origin` set to the upstream base URL

The request body always includes `language: 'de'` and `region: 'DE'` merged with endpoint-specific parameters.

## Environment

The service itself does not currently read environment variables for configuration; values are hardcoded in `config.js`. To point at a different upstream, change `UPSTREAM` directly, or adapt `config.js` to read from `process.env` as needed.