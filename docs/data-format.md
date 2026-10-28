# Data format — `data/atms.json`

The API is **source-agnostic**: the importer reads a JSON file describing ATMs
(or bank branches that host ATMs) and upserts them into MongoDB. The file that
ships with this repository is a Google Places crawler export; any file matching
the format below works, and the file may be replaced at any time.

## Top-level shape

Either a bare array of records (the provided file):

```json
[ { ...record }, { ...record } ]
```

or a wrapper object that can also carry the fetch time:

```json
{ "fetchedAt": "2026-10-18T16:29:07.519Z", "records": [ { ...record } ] }
```

`fetchedAt` (optional) is stored as `sourceFetchedAt`. When it is absent, the
file's modified time is used.

## Record fields the importer reads

| Field                | Type                          | Required | Mapping |
|----------------------|-------------------------------|----------|---------|
| `title`              | string                        | yes      | `Atm.name` (trimmed). Empty ⇒ skipped `EMPTY_NAME`. |
| `location.lat`       | number                        | yes      | `Atm.location` latitude (GeoJSON coordinates). |
| `location.lng`       | number                        | yes      | `Atm.location` longitude (GeoJSON coordinates). |
| `address`            | string \| null                | no       | `Atm.address`; falls back to `street, neighborhood, city, state`. |
| `street`, `neighborhood`, `city`, `state` | string \| null | no | Fallback address parts. |
| `categories`         | string[]                      | no       | Kept only when it contains `ATM` or a bank category (see below). |
| `openingHours`       | `{ day, hours }[]`            | no       | Parsed into `Atm.openingHours` / `Atm.is24h` (see below). |
| `placeId`            | string \| null                | no       | `Atm.sourceId` when present (stable identity). |
| `permanentlyClosed`  | boolean                       | no       | `true` ⇒ skipped `PERMANENTLY_CLOSED`. |
| `temporarilyClosed`  | boolean                       | no       | Imported (may reopen; users can report status). |
| `scrapedAt`          | ISO string \| null            | no       | Informational only; not stored per record. |

**Ignored by design (never stored):** `phone`, `phoneUnformatted`, `totalScore`,
`reviewsCount`, `reviewsDistribution`, `imagesCount`, `imageCategories`,
`plusCode`, `url`, `imageUrl`, `cid`, `fid`, `kgmid`, `businessProfileId`, and
any other field not listed above (the schema is permissive and drops unknowns).

## Bank mapping

Bank names (Arabic and English) are normalized — Arabic letters are unified
(`أ/إ/آ/ٱ → ا`, `ة → ه`, `ى → ي`), diacritics and tatweel removed, lowercased —
then matched against ordered rules into the `Atm.bank` enum:

`NBE`, `BANQUE_MISR`, `BANQUE_DU_CAIRE`, `QNB`, `CIB`, `ALEXANDRIA_BANK`,
`AGRICULTURAL_BANK`, `EGBANK`, `HOUSING_DEVELOPMENT`, `FAISAL_ISLAMIC`,
`AL_BARAKA`, `AAIB`, `BANK_NXT`, `ADCB`, `CREDIT_AGRICOLE`, `POSTAL`, `OTHER`.

Unrecognized banks fall back to `OTHER`. Detection uses `title` first, then
`address`.

## Category filtering

A record is imported only if `categories` contains `ATM` (any case) **or** a
bank category (`Bank`, `Savings bank`, `Public sector bank`, `Investment bank`,
`Trust bank`, `Cooperative bank`). Everything else is skipped and reported with
reason `NOT_ATM_CATEGORY` — the crawler export also contains shops, mosques,
schools and petrol stations that are not ATMs.

`Atm.isBranch` is `true` when the record has a bank category or its title
contains `فرع` / `branch`.

## Opening hours

Google's per-day strings are parsed into 24-hour `HH:MM` intervals:

- `"Open 24 hours"` for every day ⇒ `is24h = true`, `openingHours = null`.
- `"Closed"` ⇒ an empty interval list for that day (`[]`).
- `"8:30 AM to 2 PM"` ⇒ `{ open: "08:30", close: "14:00" }`.
- `"8 AM to 3 AM"` ⇒ `{ open: "08:00", close: "03:00" }` (close ≤ open means the
  interval wraps past midnight).
- When one side omits AM/PM it inherits the other side's meridiem
  (`"1 to 9 PM"` ⇒ `13:00–21:00`).
- If nothing parses ⇒ `openingHours = null`, `is24h = null` (unknown).

## Validation & identity

- Coordinates must be finite and inside the Egypt bounding box
  (lat 22.0–31.7, lng 24.7–36.9); otherwise skipped `OUTSIDE_EGYPT`.
- `Atm.sourceId` = `placeId` when present, otherwise a deterministic
  `sha256(normalizedName | lat(5dp) | lng(5dp))` prefixed with `gen_`.
- The upsert key is `(source, sourceId)`, so re-running the import is
  idempotent: existing documents are updated, new documents are inserted, nothing is
  deleted.
- Same-bank records within ~15 m of each other are reported as near-duplicates
  (they are **not** deleted).

## Skipped records

Skipped records never abort the import. The summary groups them by reason:

`INVALID_RECORD`, `EMPTY_NAME`, `MISSING_LOCATION`, `INVALID_COORDINATES`,
`OUTSIDE_EGYPT`, `NOT_ATM_CATEGORY`, `PERMANENTLY_CLOSED`.
