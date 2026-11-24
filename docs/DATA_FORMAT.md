# Weekly deals data format (schemaVersion 1)

## Areas

`public/data/areas.json` lists the areas people can pick under **Change location**:

```json
{ "areas": [
  { "id": "west-bend-wi", "name": "West Bend, WI", "data": "/data/current.json" },
  { "id": "chicago-il",   "name": "Chicago, IL",   "data": "/data/chicago-il/current.json" }
] }
```

Each area's weekly roundup writes two identical files in that area's folder:

| Area | Archive copy | What the app loads |
|---|---|---|
| West Bend | `public/data/<edition>.json` | `public/data/current.json` |
| Any other area | `public/data/<area id>/<edition>.json` | `public/data/<area id>/current.json` |

(West Bend keeps the top-level paths it started with.) To add an area: add its folder and files, then add one line to `areas.json`. Area ids never change once published, because saved list items record them.

`npm run validate` (also run by `npm run build`) checks every area's `current.json` against the rules below and fails the build if anything is wrong.

Store ids are per area, but a chain present in several areas uses the same id everywhere (`aldi`, `traderjoes`), so a starred store carries across areas. Chicago ids: `jewel-osco`, `marianos`, `petes-fresh`, `cermak`, `target`, `whole-foods`, `tonys-fresh`, `aldi`, `traderjoes`.

## Top level

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | |
| `edition` | `"YYYY-MM-DD"` | Date the roundup ran (Wednesday). Saved list items record this so the app can flag old prices. |
| `title` | string | Date range for display, e.g. `"Nov 18–26, 2026"` |
| `area` | string | `"West Bend, WI"` |
| `summary` | string, optional | One or two sentences about the week |
| `generatedAt` | ISO timestamp | |
| `sourceDoc` | URL, optional | Link to that week's Claude Doc |
| `stores` | Store[] | |
| `deals` | Deal[] | Every priced item from every store |
| `best` | `{dealId, note?}[]` | The "Best deals" picks; `dealId` must exist in `deals` |
| `staples` | Staple[] | "Cheapest store for staples" table |
| `compare` | CompareRow[] | Items on sale at 2+ stores |
| `gaps` | string[] | What couldn't be collected, and why |
| `sources` | `{label, url?}[]` | |

## Store

| Field | Type | Notes |
|---|---|---|
| `id` | lowercase slug | Must stay the same every week: users' favorite stores and saved items refer to it. Current ids: `sendiks`, `picknsave`, `festival`, `aldi`, `outpost`, `traderjoes`, `walmart`. Add a new id only for a new store. |
| `name` | string | |
| `location` | string, optional | |
| `adStart`, `adEnd` | `"YYYY-MM-DD"`, optional | Omit `adEnd` when the ad doesn't state it |
| `dates` | string | Dates as the ad states them |
| `priceType` | `"sale"`, `"regular"` or `"none"` | `regular` for Trader Joe's Fearless Flyer; `none` when there's no ad (Walmart) |
| `notes` | string[], optional | Caveats shown under the store name |

## Deal

| Field | Type | Notes |
|---|---|---|
| `id` | string | `<storeId>-<slug of name>`, unique in the file; add `-2`, `-3` for duplicates |
| `storeId` | string | Must match a store |
| `department` | string | As grouped in the doc ("Meat", "Produce"…) |
| `name` | string | Self-contained: include the product type and size if given (write "Jennie-O frozen Grade A turkey", not "Jennie-O frozen Grade A") |
| `price` | string | As printed: `"$2.99"`, `"$1.29/lb"`, `"2/$5"`, `"BOGO"`, `"25% off"` |
| `conditions` | string, optional | Card, digital coupon, limit, owner price, rebate |
| `regularPrice` | string, optional | When the ad states it |
| `unverified` | boolean, optional | `true` when the unit, size or price couldn't be confirmed |

## Staple

`{ item, cheapestStoreId?, cheapest, others, traderJoes? }`: all strings, as in the doc's table.

## CompareRow

`{ item, prices: { <storeId>: "text" }, conditions? }`: include only the stores that have the item on sale.
