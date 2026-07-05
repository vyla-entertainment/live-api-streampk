# Channels

Two endpoints expose channel listings: the full catalog, and a country-filtered view. Both share the same response shape and pagination behavior.

## `GET /api/channels`

Returns all channels in the catalog.

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `cursor` | integer | No | Pagination cursor returned by a previous request's `nextCursor`. Omit for the first page. |

### Example

```
$ curl http://localhost:3000/api/channels
```

```json
{
  "channels": [
    {
      "id": "260899871594bf6b2af5f4",
      "name": "192 TV |E",
      "country": "Netherlands",
      "logo": "https://iptv-org.github.io/logos/192tv-nl.png",
      "slug": "192-tv-e-260899871594bf6b2af5f4",
      "links": {
        "stream": "/api/stream/260899871594bf6b2af5f4"
      }
    }
  ],
  "nextCursor": null
}
```

---

## `GET /api/channels/:country`

Returns channels filtered to a specific country.

### Path Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `country` | string | Yes | Country name as returned by [`/api/countries`](./COUNTRIES.md), e.g. `Netherlands`. |

### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `cursor` | integer | No | Pagination cursor returned by a previous request's `nextCursor`. |

### Example

```
$ curl http://localhost:3000/api/channels/Netherlands
```

```json
{
  "channels": [
    {
      "id": "260899871594bf6b2af5f4",
      "name": "192 TV |E",
      "country": "Netherlands",
      "logo": "https://iptv-org.github.io/logos/192tv-nl.png",
      "slug": "192-tv-e-260899871594bf6b2af5f4",
      "links": {
        "stream": "/api/stream/260899871594bf6b2af5f4"
      }
    }
  ],
  "nextCursor": null
}
```

---

## Channel Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Upstream channel identifier. Used to build `slug` and to resolve streams. |
| `name` | string | Raw channel name as provided by the upstream catalog (may include suffixes such as `|E`). |
| `country` | string | Country/group the channel is listed under. |
| `logo` | string \| null | Logo URL sourced from the iptv-org logo database (see [Logo Enrichment](./LOGO_ENRICHMENT.md)). `null` if no match was found; never falls back to the upstream provider's own logo. |
| `slug` | string | URL-friendly identifier derived from `name` and `id`. |
| `links.stream` | string | Relative path to resolve this channel's playable stream, see [Stream Resolution](./STREAM.md). |

### Pagination

Both endpoints return a `nextCursor` value. When `nextCursor` is `null`, there are no further pages. Otherwise, pass it back as the `cursor` query parameter to fetch the next page:

```
$ curl "http://localhost:3000/api/channels?cursor=25"
```

### Error Response

```json
{ "error": "Upstream error 500" }
```

Returned with the upstream's status code, or `502` if the upstream request could not complete (e.g. timeout).