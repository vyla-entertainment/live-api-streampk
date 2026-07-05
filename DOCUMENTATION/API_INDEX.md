# API Index

## `GET /api`

Returns a machine-readable summary of the API and the endpoints it exposes.

### Response

- **Content-Type:** `application/json`
- **Status:** `200 OK`

### Example

```
$ curl http://localhost:3000/api
```

```json
{
  "name": "live-api",
  "description": "Live IPTV aggregator",
  "endpoints": [
    "/api/countries",
    "/api/channels",
    "/api/channels/:country",
    "/api/stream/:id"
  ]
}
```

### Notes

- This endpoint is static and does not call the upstream provider.
- Useful as a health check or as a discovery endpoint for clients that want to enumerate available routes.