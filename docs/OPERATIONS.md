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

**Step 0 — run the preflight, and fix what it refuses.** The production `env` block exists in both
`wrangler.jsonc` files, but the Hyperdrive id is the all-zeros placeholder until the production Supabase
project exists. The script reads config and secret *names* only — it never prints a value — and exits 1
while anything is still staging-shaped or unconfigured:

```bash
pnpm check:production                 # add --skip-secrets to check config only
```

It refuses, among others: a production Hyperdrive id that is the staging one (live traffic on staging
data), any production var still naming a `staging` origin, and a missing `BETTER_AUTH_SECRET` /
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `R2_*` secret on the production Worker.

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

---

## 8. Mobile Release (Android) — verified 2026-10-21

The app is an Expo project with Continuous Native Generation: `android/` and `ios/` are **not** in git
(`.gitignore`), and the native project is produced on demand. Everything below was run on this machine
(JDK 21, Android SDK at `~/Android/Sdk`, SDK 36) and produced a working APK.

### 8.1 Build a test APK (debug-signed, installable, NOT for Play Store)
```bash
cd apps/mobile
npx expo prebuild --platform android --no-install
cd android
export ANDROID_HOME="$HOME/Android/Sdk"
./gradlew assembleRelease          # ~3 min warm; JS bundle embedded (Hermes)
# → app/build/outputs/apk/release/app-release.apk
```
`prebuild` rewrites the `android`/`ios` scripts in `package.json` to `expo run:*`. Revert that (or do not
commit it): `android/` is generated, so `expo start --android` stays the correct dev command.

The template signs `release` with the **debug** keystore (`android/app/build.gradle`, with an explicit
caution comment). That is fine for installing on a phone or emulator and wrong for distribution: Play
refuses a debug certificate.

### 8.2 Build a Play Store bundle (AAB)
```bash
cd apps/mobile/android && ./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab
```
The same debug-keystore caveat applies until §8.3 is done.

### 8.3 Release keystore — an owner secret, never in the repo
Generate once, keep the file and both passwords outside git (password manager + offline copy). Losing it
means never being able to update the app under the same listing.
```bash
keytool -genkeypair -v -keystore pmk-core-release.keystore -alias pmk-core \
        -keyalg RSA -keysize 4096 -validity 10000
```
Wire it in through a gitignored `android/keystore.properties` (and a matching `signingConfigs.release`
block in `android/app/build.gradle`, which is generated, so the block must also live in a config plugin if
it is to survive `prebuild`):
```properties
storeFile=/absolute/path/outside/repo/pmk-core-release.keystore
storePassword=…
keyAlias=pmk-core
keyPassword=…
```
Alternative: let EAS hold the credentials — `eas credentials` / `eas build --profile production`
(`apps/mobile/eas.json` already defines `preview` as an APK and `production` as an app-bundle).

### 8.4 Version bump before every upload
- `apps/mobile/app.json` → `expo.version` (user-visible, e.g. `1.0.0`).
- `android/app/build.gradle` → `versionCode` must increase monotonically (1, 2, 3…); Play rejects a
  duplicate. With EAS, `autoIncrement` handles it.

### 8.5 Publish
Play Console (one-time USD 25) → create the app → upload the AAB → internal testing track first → data
safety form + privacy policy URL + screenshots → review. `eas submit -p android` automates the upload.

### 8.6 iOS
Not possible from this machine: iOS builds need macOS + Xcode or EAS cloud, and distribution needs a paid
Apple Developer account (USD 99/yr), which ADR-0004 explicitly rules out. iOS is a development/simulator
target only. The only free path is an EAS **simulator** build (`eas build -p ios --profile preview` with
`ios.simulator: true`), which still needs a Mac to run.

### 8.7 What has and has not been proven
Verified 2026-10-21: release APK builds (68 MB, `id.web.pmkitera.core`, versionCode 1, targetSdk 36, JS
bundle embedded, V2-signed with the debug key), installs on a Pixel_8a emulator, launches, renders the
sign-in screen, opens the API's `/sign-in` page in a Chrome Custom Tab, and `picore://auth` resolves back
into `MainActivity`. **Not** verified: a completed Google sign-in on a device, and anything on iOS.
