# Logo Enrichment

Channel logos are sourced exclusively from the [iptv-org](https://github.com/iptv-org/api) open channel database, not from the upstream IPTV provider. This keeps channel branding consistent and independent of the upstream provider's own (often inconsistent or low-quality) logo assets.

## How It Works

1. On startup, and once every 24 hours thereafter, the service downloads two datasets from iptv-org:
   - `https://iptv-org.github.io/api/channels.json` — channel metadata, including canonical names and alt names
   - `https://iptv-org.github.io/api/logos.json` — logo URLs keyed by channel ID
2. For each iptv-org channel with a known logo, its name (and any alternate names) are normalized into lookup keys and mapped to that logo URL.
3. When shaping a channel from the upstream provider, its name is normalized the same way and used to look up a match in this in-memory map.
4. If a match is found, that iptv-org logo URL is used. If no match is found, `logo` is `null`.

## Name Normalization

Because the upstream provider's channel names include decorations that iptv-org's names do not (e.g. `192 TV |E`, `RTL 4 |E`), names are normalized before comparison:

- Trailing `|`-delimited suffixes are stripped (e.g. `|E`, `|H`)
- Bracketed and parenthesized segments are removed
- Common quality/region tags (`HD`, `FHD`, `UHD`, `4K`, `RAW`, `TR:`) are stripped
- All non-alphanumeric characters are removed
- The result is lowercased

Two normalized variants are indexed and checked: one with the standalone word `TV` also stripped, and one with it preserved. This avoids false negatives for channels whose canonical name legitimately contains "TV" as part of the brand (e.g. `192TV`) versus channels where "TV" is just a generic suffix added by the upstream provider.

## Guarantees

- **No upstream logo fallback.** If iptv-org has no matching entry, `logo` is `null`. The API will never silently substitute the upstream provider's own logo URL.
- **Best-available match.** If iptv-org lists multiple logos for the same channel ID, the first one encountered is used.

## Refreshing

The iptv-org datasets are refetched automatically every 24 hours via an interval timer. A failed refresh (e.g. network error) is caught silently and the previous in-memory map remains in use until the next successful refresh.