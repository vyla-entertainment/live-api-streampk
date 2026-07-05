---
title: live-api
emoji: 📺
colorFrom: purple
colorTo: pink
sdk: docker
pinned: false
license: other
app_file: server.js
---

# Live IPTV

A lightweight Express API that aggregates live IPTV channel data from an upstream provider, enriches channel logos using the [iptv-org](https://github.com/iptv-org/api) open database, and exposes clean, normalized endpoints for browsing channels and resolving playable stream URLs.

## Features

- Browse channels by country
- Search the full channel catalog with cursor-based pagination
- Automatic logo enrichment from iptv-org, decoupled from the upstream provider's branding
- Resolve any channel ID into a playable stream URL
- Built-in response caching to reduce load on the upstream provider

## Quick Start

```bash
npm install
node app.js
```

The server starts on `http://localhost:3000` by default (or the port configured in your environment).

## Base URL

```
http://localhost:3000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service banner and metadata |
| GET | `/api` | API index listing available endpoints |
| GET | `/api/countries` | List all available countries |
| GET | `/api/channels` | List all channels (paginated) |
| GET | `/api/channels/:country` | List channels filtered by country (paginated) |
| GET | `/api/stream/:id` | Resolve a channel ID into a playable stream URL |

Full details for each endpoint, including request/response shapes and examples, are in the [`DOCUMENTATION`](./DOCUMENTATION) folder:

- [API Index](./DOCUMENTATION/API_INDEX.md)
- [Countries](./DOCUMENTATION/COUNTRIES.md)
- [Channels](./DOCUMENTATION/CHANNELS.md)
- [Stream Resolution](./DOCUMENTATION/STREAM.md)
- [Logo Enrichment](./DOCUMENTATION/LOGO_ENRICHMENT.md)
- [Configuration](./DOCUMENTATION/CONFIGURATION.md)
- [Architecture](./DOCUMENTATION/ARCHITECTURE.md)
- [Error Handling](./DOCUMENTATION/ERRORS.md)

## Project Structure

```
.
├── app.js                  Express app setup and route mounting
├── config.js                Upstream URL, cache TTL, and timeout settings
├── upstreamClient.js        Upstream HTTP client with caching and timeout handling
├── utils.js                 Channel shaping and iptv-org logo enrichment
└── routes/
    ├── root.js               Root banner route
    └── api.js                API route handlers
```

## License / Disclaimer

This project aggregates publicly available IPTV metadata. See the DMCA notice referenced in the root route for takedown requests.