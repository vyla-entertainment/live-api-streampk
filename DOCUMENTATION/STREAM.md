# Stream Resolution

## `GET /api/stream/:id`

Resolves a channel ID into one or more playable stream URLs.

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | Channel ID as returned in a channel object's `id` field (see [Channels](./CHANNELS.md)). |

### Response

- **Content-Type:** `application/json`
- **Status:** `200 OK` on success, `502` on failure

An array of stream objects:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stream name or identifier from the upstream resolver. |
| `name` | string | Human-readable stream name (often the same as `id`). |
| `url` | string | Directly playable stream URL. |

### Example

```
$ curl http://localhost:3000/api/stream/260899871594bf6b2af5f4
```

```json
[
  {
    "id": "192 TV",
    "name": "192 TV",
    "url": "https://example-cdn.net/live/192tv/index.m3u8"
  }
]
```

### Error Response

```json
{ "error": "Upstream error 404" }
```

### Notes

- Internally, this endpoint builds an upstream "play" URL from the given `id` and asks the upstream resolver for the actual stream, so the `id` must be one previously returned by a channels endpoint rather than an arbitrary value.
- Responses are subject to the shared upstream cache (see [Configuration](./CONFIGURATION.md)), so repeated calls for the same `id` within the cache TTL will return the cached result rather than re-resolving upstream.
- Streams are typically HLS (`.m3u8`) but the format is determined entirely by the upstream provider.