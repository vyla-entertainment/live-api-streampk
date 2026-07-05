# Error Handling

## Response Shape

All error responses are JSON with a single field:

```json
{ "error": "<message>" }
```

## Status Codes

| Status | Meaning | When it occurs |
|--------|---------|-----------------|
| `404` | Not Found | Any route not matched by `/` or `/api/*`. |
| `502` | Bad Gateway | Default fallback when an upstream call fails without a specific status (e.g. network error), and always used for `/api/stream/:id` failures. |
| `504` (as message, surfaced via `502`/upstream status handling) | Gateway Timeout | The upstream request exceeded `UPSTREAM_TIMEOUT` (8 seconds by default) and was aborted. |
| *(varies)* | Upstream-defined | For `/api/countries` and `/api/channels*`, if the upstream provider responds with a non-2xx status, that same status code is passed through. |

## Examples

### Route not found

```
$ curl http://localhost:3000/nonexistent
```

```json
{ "error": "Not found" }
```

### Upstream timeout

```json
{ "error": "Upstream request timed out" }
```

### Upstream non-2xx response

```json
{ "error": "Upstream error 503" }
```

## Notes for API Consumers

- Always check the HTTP status code in addition to parsing the JSON body; the `error` message is intended for debugging/logging rather than presentation to end users.
- Transient `502`/timeout errors are good candidates for client-side retry with backoff, since they often reflect temporary upstream unavailability rather than a permanent failure.
- A `404` almost always indicates a typo'd path or an unsupported HTTP method rather than a missing resource, since resource-style 404s (e.g. unknown channel ID) are not distinguished from generic upstream errors in the current implementation.