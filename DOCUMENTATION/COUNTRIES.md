# Countries

## `GET /api/countries`

Returns the list of countries available in the upstream catalog. Use these values as the `:country` parameter on the [Channels by Country](./CHANNELS.md#get-apichannelscountry) endpoint.

### Response

- **Content-Type:** `application/json`
- **Status:** `200 OK` on success, `502` (or upstream status) on failure

### Response Shape

An array of country filter values as returned by the upstream provider's `group` facet. Exact field names depend on the upstream response, but each entry generally identifies a country name usable as a filter value.

### Example

```
$ curl http://localhost:3000/api/countries
```

```json
[
  { "id": "Netherlands", "label": "Netherlands" },
  { "id": "Germany", "label": "Germany" },
  { "id": "Belgium", "label": "Belgium" }
]
```

*(Actual shape mirrors whatever the upstream `group` filter facet returns.)*

### Error Response

```json
{ "error": "Upstream error 500" }
```

### Notes

- Data is fetched from the upstream catalog endpoint and is subject to the shared response cache (see [Configuration](./CONFIGURATION.md)).
- If the upstream provider changes its filter schema, this endpoint's shape will change accordingly since it passes the `group` filter values through largely unmodified.