# Incentives: Auditability & Historical Reconstruction

## Requirements (summary)

- **Raw source snapshots** stored per scrape
- **Full version lineage** retained; no destructive updates
- **Immutable audit log**: scrape events, record changes, failures
- **Retention**: indefinite

## Historical reconstruction

The system answers deterministically:

> **"What national incentives were active for OEM X, model Y, on date T?"**

---

## Schema (audit & lineage)

| Table | Purpose |
|-------|--------|
| `scrape_events` | One row per scrape run: source, brand, started_at, completed_at, status (running \| success \| failure), records_inserted, records_replaced, records_failed, error_message |
| `scrape_snapshots` | Raw request body per scrape (JSONB). Immutable; indefinite retention. |
| `offer_versions` | Full version lineage: every version of every offer with `effective_from` / `effective_to`. No destructive updates. |

- **Current state** remains in `Offers` (same as before).
- **`lib/incentives/storeScrapedIncentives.ts`** is the single path for storing scraped data: it creates the event, snapshot, archives current rows to `offer_versions`, deletes by brand, inserts new rows into `Offers` and `offer_versions`, and updates the event. It is used by:
  - **`POST /api/incentives/scrape`** (after validating the request body), and
  - **`lib/offers/*.ts`** scrapers when invoked by the cron job (each scraper returns normalized offers and calls `storeScrapedIncentives` instead of using Prisma directly).
- On each scrape we:
  1. Create a `scrape_events` row (status `running`).
  2. Store the raw body in `scrape_snapshots`.
  3. Copy existing offers for that brand into `offer_versions` with `effective_to = now()`.
  4. Delete and re-insert current offers for that brand in `Offers`.
  5. Insert the new rows into `offer_versions` with `effective_from = now()`, `effective_to = null`.
  6. Update `scrape_events` (completed_at, status, counts). On failure, set status `failure` and error_message.

---

## APIs

| Endpoint | Description |
|----------|-------------|
| `GET /api/incentives/active-on-date?oem=Kia&model=Sportage&date=2025-06-15` | Incentives that were **active** for the given OEM (and optional model) **on date T**. `date` defaults to today (UTC). |

**Active on date T** is defined as:

- Version in effect at T: `effective_from <= T` and (`effective_to` is null or `effective_to > T`).
- Not expired at T: `expiration_date` is null or `expiration_date >= T`.

Response includes `incentives` (array) and `query: { oem, model, onDate }`.

---

## Migrations

1. **Version on Offers** (if not already applied): `20260212181517_add_version_to_offer` — adds `version` and trigger to increment on update.
2. **Audit & lineage**: `20260228180000_audit_scrape_events_and_offer_versions` — creates `scrape_events`, `scrape_snapshots`, `offer_versions`.

After pulling schema changes, run:

```bash
npx prisma generate
npx prisma migrate deploy
```

(Or `npx prisma migrate dev` in development.)
