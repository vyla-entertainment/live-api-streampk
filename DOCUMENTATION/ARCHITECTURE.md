# Architecture

## Overview

The service is a thin Express layer that sits between clients and an upstream IPTV catalog/resolver provider, normalizing responses and swapping out logo sources along the way.

```
Client
  │
  ▼
Express app (app.js)
  │
  ├── / ────────────────────► routes/root.js  (static banner)
  │
  └── /api ─────────────────► routes/api.js
                                 │
                                 ├── /countries ───► upstreamClient.js ──► upstream provider
                                 ├── /channels ─────► upstreamClient.js ──► upstream provider
                                 ├── /channels/:c ──► upstreamClient.js ──► upstream provider
                                 └── /stream/:id ───► upstreamClient.js ──► upstream provider

                              utils.js
                                 │
                                 ├── shapeChannel()      normalizes each upstream item
                                 └── getIptvOrgLogo()    looks up logo from iptv-org dataset
                                        │
                                        ▼
                              iptv-org channels.json / logos.json
                              (fetched on startup + every 24h)
```

## Modules

### `app.js`
Creates the Express app, applies CORS, serves static assets from `public/`, and mounts the root and API routers. Any unmatched route returns a `404` JSON error.

### `config.js`
Holds the upstream base URL, cache TTL, and request timeout as constants. See [Configuration](./CONFIGURATION.md).

### `upstreamClient.js`
A single function, `upstreamPost`, that POSTs to the upstream provider with standardized headers and a default `{ language: 'de', region: 'DE' }` body, applies an in-memory TTL cache, and enforces a request timeout via `AbortController`. All upstream errors are normalized into JS `Error` objects carrying an HTTP `status`.

### `utils.js`
- `toSlug` — converts a channel name into a URL-safe slug.
- `cleanChannelName` / `cleanChannelNameKeepTv` — normalize channel names into comparable keys, with and without stripping the word "TV".
- `loadIptvOrgData` — fetches iptv-org's channel and logo datasets and builds an in-memory lookup map keyed by normalized channel name.
- `getIptvOrgLogo` — looks up a logo URL for a given channel name.
- `shapeChannel` — converts a raw upstream catalog item into the API's public channel shape, including the enriched logo (see [Logo Enrichment](./LOGO_ENRICHMENT.md)).


### `routes/api.js`
Defines all `/api/*` routes and delegates upstream communication to `upstreamClient.js`, shaping results with `utils.js` where applicable.

## Data Flow: Channel Listing

1. Client requests `GET /api/channels/Netherlands`.
2. `routes/api.js` calls `upstreamPost('/mediaurl-catalog.json', { ...filter: { group: 'Netherlands' } })`.
3. `upstreamClient.js` checks its cache; on a miss, it POSTs to the upstream provider and caches the JSON response.
4. Each item in the response is passed through `shapeChannel`, which:
   - Extracts `id`, `name`, and `country`
   - Looks up a logo via `getIptvOrgLogo(name)`
   - Builds a `slug` and the relative `stream` link
5. The shaped list and `nextCursor` are returned to the client as JSON.

## Data Flow: Stream Resolution

1. Client requests `GET /api/stream/:id`.
2. `routes/api.js` builds an upstream "play" URL from `:id` and calls `upstreamPost('/mediaurl-resolve.json', { url })`.
3. The upstream response (a single object or array) is normalized into an array of `{ id, name, url }` stream objects and returned to the client.