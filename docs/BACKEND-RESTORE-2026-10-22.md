# AIVAULT backend restore evidence — 2026-10-22

## Scope
Second-base Supabase only: `svtkpdmqemidlasowqew`.

## Action
- Restore request accepted successfully.
- Project status after restore: `COMING_UP`.
- Region: `ap-northeast-1`.
- PostgreSQL: `17.6.1.155`.
- No schema mutation, data deletion, function deployment, secret change, or production deployment performed.

## Existing Edge Functions observed
- `bright-service` — ACTIVE v3 — JWT required
- `constitution-import` — ACTIVE v3 — JWT required
- `fetch-roc-tw-constitutional-court` — ACTIVE v2 — JWT not required

These functions are preserved pending dependency review.

## Database inventory status
The first read-only table inventory attempt timed out while the restored database was still `COMING_UP`. No conclusion is drawn about table presence or absence. Retry only after the project reaches a healthy active state.

## Protected systems
No action was taken against:
- `NL13741619-commits/safe-reunion-login`
- `NL13741619-commits/safe-reunion`
- Supabase `perfsipperncvjocznhl`

## Next gate
After second-base database readiness:
1. read-only inventory of schemas/tables/RLS/RPC/storage/auth dependencies;
2. classify legacy assets as keep/migrate/delete-candidate;
3. do not perform destructive cleanup until separately approved;
4. build AIVAULT agent persistence and gateway only after the inventory is recorded.
