---
name: db-migrations
description: Use when changing the PostgreSQL schema, writing migrations or seeds, adding indexes/constraints/RLS, or running database commands for PI-CORE (Drizzle + Supabase via Hyperdrive). Load before any schema or seed change.
---

# Database & migrations skill

## Rules
1. Schema lives in `packages/db` (Drizzle). Every change = generated SQL migration committed to git. Never edit applied migrations; add a new one.
2. Inspect first: current schema, migration history, which database the connection string points to (local / staging / production). **Print the target host (not the password) before running anything.**
3. Production migrations and anything destructive (DROP, TRUNCATE, column type narrowing, data deletes) require explicit owner approval. Prefer expand -> migrate data -> contract across separate releases.
4. Seeds are idempotent (upsert by stable keys): org units, positions, roles, permissions, role_permissions, position_roles, allowed_email_domains, periods bootstrap. Seeds never contain real personal data or secrets.
5. Integrity in the database, not only in code: FKs, unique constraints, check constraints, the partial unique index for the single active period, uniqueness of `is_unique_per_unit` positions per (unit, period).
6. Security: enable RLS on all tables with no public policies; confirm Supabase Data API is not exposing them; audit_logs is append-only (revoke UPDATE/DELETE from app role).
7. Use a least-privilege application DB role for the Worker; a separate migration role used only by CI/maintainers.
8. Performance: index FKs and search columns; verify subtree queries (path/closure) with EXPLAIN on realistic volume (>= 5k members, thousands of assignments).

## Verification
- Migrations apply on an empty database AND on a copy of the current state; seed twice -> no changes the second time.
- Integration tests run against a real Postgres (local container or staging), covering constraints and RLS posture.
- Report: migration filenames, what each does, rollback/forward-fix plan.
