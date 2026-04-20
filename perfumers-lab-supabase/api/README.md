# Perfumery Lab — API routes

Vercel serverless functions. Two groups live here:

- Existing app/MCP/OAuth endpoints (`formulas.js`, `mcp.js`, `oauth-metadata.js`, ...)
- **Assistant API** (`assistant/*.ts`) — token-gated read/write for an external AI assistant (ChatGPT Custom Actions, Claude tool use, etc.)

## Assistant API endpoints

| Method | Path                          | Purpose                                              |
| ------ | ----------------------------- | ---------------------------------------------------- |
| GET    | `/api/assistant/read`         | Read whitelisted tables (`?table=...&filter=f:v`)    |
| POST   | `/api/assistant/write`        | Execute a whitelisted write action                   |
| GET    | `/api/assistant/openapi.json` | OpenAPI 3.0 schema for Custom Actions upload         |
| GET    | `/api/assistant/migrate`      | Returns SQL to create `assistant_audit_log` (manual) |

All endpoints except `/migrate` and `/openapi.json` require:

```
Authorization: Bearer <ASSISTANT_API_TOKEN>
```

## Required Vercel env vars

Set these in the Vercel project dashboard (Project → Settings → Environment Variables) for **Production** and **Preview**:

- `ASSISTANT_API_TOKEN` — shared bearer token used by the assistant (keep secret)
- `SUPABASE_URL` — `https://<project>.supabase.co`
- `SUPABASE_ANON_KEY` — the publishable/anon key (RLS is disabled on all tables, so anon is fully read/write)

> The Supabase `service_role` key is **never** used by the assistant endpoints — anon is sufficient since RLS is off, and keeping service_role out of this path limits blast radius.

## One-time Supabase migration

Hit `GET /api/assistant/migrate` (no auth required — it just returns SQL). Copy the SQL into the Supabase SQL editor and run it. This creates the `assistant_audit_log` table used for post-write audit trail.

## Write action shapes

All actions are posted to `/api/assistant/write` as:

```json
{ "action": "<name>", "data": { ... } }
```

### `create_stock_movement`
```json
{
  "material_source_id": "uuid",
  "movement_type": "restock | use | adjustment | production | correction",
  "grams_delta": 12.5,
  "related_formula_id": "uuid (optional)",
  "date": "2026-04-20",
  "notes": "optional",
  "batch_label": "optional",
  "production_batch_id": "uuid (optional)"
}
```

### `create_production_batch`
```json
{
  "batch_label": "string",
  "formula_id": "uuid",
  "produced_grams": 50,
  "produced_at": "2026-04-20T12:00:00Z",
  "notes": "optional"
}
```

### `update_formula_notes`
```json
{ "formula_id": "uuid", "notes": "string" }
```
> Returns 400 if the `notes` column does not exist on `formulas`.

### `update_formula_status`
```json
{ "formula_id": "uuid", "status": "active | archived" }
```
> Setting `archived` stamps `archived_at = now()`; `active` clears it.

## Validation

- Required fields — missing returns `400 { error, missing: [...] }`
- UUIDs — `/^[0-9a-f-]{36}$/i`
- `grams_delta` — finite, non-zero
- `produced_grams` — positive, finite
- `movement_type` / `status` — must match the enum above
