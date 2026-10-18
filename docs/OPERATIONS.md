# OPERATIONS & RUNBOOKS — PI-CORE

> Authoritative operations manual for PI-CORE staging and production environments.
> Covers deployment, rollbacks, migrations, break-glass incident response, key rotation, and disaster recovery.

---

## 1. System Topology & Environments

| Resource | Staging | Production (Planned) |
|---|---|---|
| **Web Portal** | `pi-core-web-staging.pmkitera.workers.dev` | `core.pmkitera.web.id` |
| **API & OIDC Engine** | `pi-core-api-staging.pmkitera.workers.dev` | `api.core.pmkitera.web.id` |
| **Database (PostgreSQL)** | Supabase project `jegddvztnjfvtbbyyutb` | Dedicated Production Supabase Project |
| **Connection Pooling** | Cloudflare Hyperdrive `afcb66f59a424787b5117c596edd29dc` | Production Hyperdrive binding |
| **Object Storage (Avatars)** | Cloudflare R2 bucket `pmk-core-avatars` | Production R2 bucket `pmk-core-avatars-prod` |

---

## 2. Deploy & Rollback Procedures

### 2.1 Staging Deployment
```bash
# Web application (Next.js via OpenNext)
pnpm --filter @pi-core/web build:worker
pnpm --filter @pi-core/web exec wrangler deploy --env staging

# API Worker (Hono)
pnpm --filter @pi-core/api exec wrangler deploy --env staging
```

### 2.2 Production Deployment (Requires Owner Approval)
> ⚠️ **Hard Rule:** Never deploy to production or execute production migrations without explicit owner confirmation in conversation.

```bash
# 1. Take a full database backup before deployment (see §6)
# 2. Deploy Web Worker
pnpm --filter @pi-core/web exec wrangler deploy --env production

# 3. Deploy API Worker
pnpm --filter @pi-core/api exec wrangler deploy --env production
```

### 2.3 Instant Rollback (Cloudflare Workers)
Cloudflare Workers maintains versioned releases. If an incident occurs immediately after deployment:
```bash
# List recent versions with their IDs and timestamps
pnpm --filter @pi-core/api exec wrangler versions list --env staging

# Roll back to the previous stable version
pnpm --filter @pi-core/api exec wrangler rollback <VERSION_ID> --env staging
pnpm --filter @pi-core/web exec wrangler rollback <VERSION_ID> --env staging
```

---

## 3. Database Migrations

### 3.1 Applying Migrations
Migrations are managed via Drizzle ORM (`packages/db/migrations/`).
```bash
# Run against the database specified in packages/db/.env
pnpm --filter @pi-core/db db:migrate
```

### 3.2 Post-Migration Verification
Ensure all tables maintain Row Level Security (RLS) with 0 public policies:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
Every table MUST have `rowsecurity = true`.

---

## 4. Break-Glass Incident Response (NFR-15)

### 4.1 Revoke All Sessions Globally (Emergency Kill Switch)
If an authentication compromise or credential leakage is suspected, terminate all active web and mobile user sessions:

```sql
-- Direct SQL execution via Supabase SQL Editor or psql session:
-- 1. Invalidate all active Better Auth web sessions
DELETE FROM "sessions";

-- 2. Invalidate all mobile single-use exchange codes
DELETE FROM "mobile_auth_codes";

-- 3. Invalidate all OAuth access tokens issued to external consumer apps
DELETE FROM "oauth_access_tokens";

-- 4. Invalidate all OAuth refresh tokens
DELETE FROM "oauth_refresh_tokens";
```

### 4.2 Revoke Sessions for a Single Compromised Member
```sql
-- Replace <MEMBER_ID> with the target UUID:
DELETE FROM "sessions" WHERE "user_id" = '<MEMBER_ID>';
DELETE FROM "oauth_access_tokens" WHERE "user_id" = '<MEMBER_ID>';
DELETE FROM "oauth_refresh_tokens" WHERE "user_id" = '<MEMBER_ID>';
```

### 4.3 Emergency Disable of an Integration (Consumer App)
If an external consumer app (e.g., PI-NEXUS, Finance, Panitia) is compromised:
```sql
-- Revoke the client registration immediately:
UPDATE "oauth_clients"
SET "status" = 'revoked',
    "updated_at" = now()
WHERE "client_id" = '<COMPROMISED_CLIENT_ID>';

-- Invalidate all currently active access and refresh tokens for that client:
DELETE FROM "oauth_access_tokens" WHERE "client_id" = '<COMPROMISED_CLIENT_ID>';
DELETE FROM "oauth_refresh_tokens" WHERE "client_id" = '<COMPROMISED_CLIENT_ID>';
```
Future calls to `/api/v1/access` using tokens from this client will be immediately rejected with HTTP 401.

### 4.4 Recovering `super_admin` Access
If the primary `super_admin` loses access or emergency administrator access must be provisioned:

```bash
# Run the bootstrap script from the project root:
BOOTSTRAP_SUPER_ADMIN_EMAIL="febrian.124140031@student.itera.ac.id" \
BOOTSTRAP_SUPER_ADMIN_NAME="Febrian Yoel" \
pnpm --filter @pi-core/db tsx scripts/bootstrap-super-admin.ts
```

Direct SQL fallback (if script is unavailable):
```sql
-- 1. Ensure member exists and is active
UPDATE "members"
SET "status" = 'active',
    "email_verified" = true
WHERE "email" = '<RECOVERY_EMAIL>';

-- 2. Grant system super_admin role
INSERT INTO "system_grants" ("id", "member_id", "role", "created_at")
SELECT gen_random_uuid(), m.id, 'super_admin', now()
FROM "members" m
WHERE m.email = '<RECOVERY_EMAIL>'
ON CONFLICT ("member_id", "role") DO NOTHING;
```

---

## 5. Key Rotation Procedures

### 5.1 OIDC Token Signing Keys (JWKS Rotation)
Better Auth OAuth Provider signs JWT access and ID tokens using asymmetric keys stored in the `jwks` table.
To rotate the signing key with zero consumer downtime:
1. Generate a new Ed25519 or RSA keypair.
2. Insert the new public/private key into the `jwks` table with a new `id`.
3. Retain the old public key in `jwks` for at least 24 hours so consumers can verify existing unexpired access tokens.
4. Retire the old key after token TTL expiration.

### 5.2 Better Auth Secret & Cookie Signing Key
If `BETTER_AUTH_SECRET` must be rotated:
```bash
# Generate high-entropy secret
openssl rand -base64 32

# Update staging secret via Cloudflare CLI
pnpm --filter @pi-core/api exec wrangler secret put BETTER_AUTH_SECRET --env staging
```
*Note:* Rotating `BETTER_AUTH_SECRET` invalidates existing browser session cookies, requiring users to log in again.

### 5.3 Google OAuth Client Credentials
1. Create a new client secret in Google Cloud Console (`APIs & Services` → `Credentials`).
2. Update the secret in Cloudflare Workers:
   ```bash
   pnpm --filter @pi-core/api exec wrangler secret put GOOGLE_CLIENT_SECRET --env staging
   ```
3. Delete the retired secret in Google Cloud Console.

---

## 6. Disaster Recovery & Database Backup Drill

### 6.1 Logical Backup Procedure (`pg_dump`)
Because Supabase Free tier does not include automated point-in-time recovery, execute manual logical dumps before major schema changes or production releases:
```bash
# Set DIRECT_URL from packages/db/.env
pg_dump "$DIRECT_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="backup-$(date +%Y%m%d-%H%M%S).dump"
```

### 6.2 Restore Drill Procedure (Non-Production Validation)
To verify backup integrity without affecting production or staging:
1. Spin up a temporary PostgreSQL instance (or throwaway Supabase project / local Docker container):
   ```bash
   docker run --name pg-restore-drill -e POSTGRES_PASSWORD=drillpass -p 54329:5432 -d postgres:17
   ```
2. Restore the dump into the drill database:
   ```bash
   pg_restore --dbname="postgresql://postgres:drillpass@localhost:54329/postgres" \
     --clean --if-exists backup-*.dump
   ```
3. Run verification queries to ensure row counts and catalog tables match expectations.
4. Tear down the test container:
   ```bash
   docker rm -f pg-restore-drill
   ```

---

## 7. On-Call Incident Checklist

In the event of an operational incident:
1. **Triage Severity:**
   - **P0 (Outage / Security Compromise):** Service unavailable or active breach. Execute Break-Glass runbook (§4), roll back deployment (§2.3), or notify stakeholders.
   - **P1 (Degraded Performance):** Tail staging logs:
     ```bash
     pnpm --filter @pi-core/api exec wrangler tail --env staging
     ```
   - **P2 (Non-blocking bug):** Log issue, investigate via correlation `requestId`.
2. **Trace correlation:** Check inbound `x-request-id` header in Cloudflare Workers Logs and match with `audit_logs.request_id`.
3. **Escalate:** Reach the project administrator (`biroitpmkitera@gmail.com`).
