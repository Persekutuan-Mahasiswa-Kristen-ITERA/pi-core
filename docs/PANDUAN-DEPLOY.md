# PANDUAN DEPLOY — PI-CORE

Panduan praktis untuk pemilik: cara men-deploy **website + API** dan **aplikasi Android**.
Bahasa Indonesia; perintah dan nama teknis tetap Inggris.

Tanda kejujuran yang dipakai di seluruh dokumen ini:

- **[terbukti]** — sudah dijalankan di mesin ini dan hasilnya dicek (tanggal 2026-10-21).
- **[tertulis]** — perintahnya benar menurut tool-nya, tetapi belum pernah dijalankan untuk PI-CORE.

Manual operasional lengkap (insiden, rotasi kunci, backup) ada di `docs/OPERATIONS.md`.
Status proyek ada di `docs/STATE.md`.

---

## 0. Ringkasan: apa yang ada di mana

| Bagian | Isi | Alamat |
|---|---|---|
| Web admin (Next.js di Cloudflare Workers) | dashboard, anggota, peran, periode, penugasan, integrasi, pengaturan, audit log | https://pi-core-web-staging.pmkitera.workers.dev |
| API + OIDC provider (Hono di Workers) | `/api/v1/*`, `/api/auth/*`, `/sign-in` | https://pi-core-api-staging.pmkitera.workers.dev |
| Database | PostgreSQL Supabase, diakses lewat Cloudflare Hyperdrive | project staging (lihat `docs/OPERATIONS.md` §1) |
| Penyimpanan foto | Cloudflare R2 | bucket `pmk-core-avatars` (staging) |
| Aplikasi Android | Expo / React Native | APK & AAB di `~/Documents/pi-core-artifacts/` |

Produksi (belum aktif): `core.pmkitera.web.id` dan `api.core.pmkitera.web.id`.

---

## 1. Prasyarat

Yang dibutuhkan di komputer:

- Node 20+ (di mesin ini v26) dan pnpm 10 (`pnpm --version`).
- Akun Cloudflare dengan akses ke Worker `pi-core-web-staging` / `pi-core-api-staging`.
  `wrangler` tidak perlu dipasang global — dipanggil lewat `pnpm exec`.
- Untuk mobile: JDK 17+ (di mesin ini JDK 21) dan Android SDK (di mesin ini `~/Android/Sdk`, SDK 36).

Login Cloudflare sekali per mesin **[tertulis]**:

```bash
pnpm --filter @pi-core/web exec wrangler login
pnpm --filter @pi-core/web exec wrangler whoami     # cek akun yang aktif
```

Secret **tidak pernah** masuk repo, chat, atau log. Semua secret dipasang lewat
`wrangler secret put` (interaktif, nilainya tidak terlihat di shell history).

---

## 2. Deploy website + API ke STAGING

### 2.1 Cek dulu di lokal **[terbukti]**

> Sejak ADR-0019, URL `*.workers.dev` **bukan environment terpisah**: ia hanya alamat uji dari deployment
> yang sama, dan menulis ke database yang sama dengan produksi. Perlakukan setiap percobaan di sana
> sebagai percobaan pada data asli.

```bash
pnpm install
pnpm -r typecheck        # harus "Done" untuk 6 package
pnpm -r test             # 275 test: shared 96, api 96, web 52, mobile 31
pnpm -r lint             # 0 error (warning lama boleh ada)
```

Jangan deploy kalau ada test merah. Deploy bukan tempat menemukan bug.

### 2.2 Deploy API (biasanya lebih dulu) **[terbukti]**

```bash
pnpm --filter @pi-core/api exec wrangler deploy --env staging
```

Yang muncul di akhir: `Uploaded pi-core-api-staging` + `Current Version ID: …`.
**Catat Version ID** — itu yang dipakai untuk rollback.

Kalau ada perubahan **schema database**, jalankan migrasi dulu (lihat `docs/OPERATIONS.md` §3),
karena Worker baru bisa membaca kolom yang belum ada dan akan gagal 500.

### 2.3 Deploy web **[terbukti]**

```bash
pnpm --filter @pi-core/web build:worker     # OpenNext → .open-next/worker.js
pnpm --filter @pi-core/web exec wrangler deploy --env staging
```

`build:worker` wajib dijalankan setiap kali kode web berubah — `wrangler deploy` hanya mengunggah
hasil build yang sudah ada di `.open-next/`.

### 2.4 Verifikasi setelah deploy **[terbukti]**

```bash
API=https://pi-core-api-staging.pmkitera.workers.dev
WEB=https://pi-core-web-staging.pmkitera.workers.dev

curl -s -o /dev/null -w '%{http_code}\n' $API/api/v1/health          # 200
curl -s -o /dev/null -w '%{http_code}\n' $API/api/v1/me              # 401 (anonim = benar)
curl -s -o /dev/null -w '%{http_code}\n' $WEB/                       # 200
curl -s -o /dev/null -w '%{http_code}\n' $WEB/integrations           # 200
```

Lalu buka di browser dan pastikan:

1. Halaman termuat dan kartu statistik berbunyi "Masuk untuk melihat" (belum login) — bukan angka.
2. Tombol "Masuk dengan Google" membuka halaman Google (bukan error).
3. Setelah login: dashboard menampilkan angka, `/anggota` terisi, `/audit-log` bisa difilter.
4. Konsol browser tanpa error dan tanpa pelanggaran CSP.

### 2.5 Lihat log dan rollback **[terbukti]**

```bash
# log real-time (CPU time, status, error)
pnpm --filter @pi-core/api exec wrangler tail --env staging

# daftar versi
pnpm --filter @pi-core/web exec wrangler versions list --env staging

# kembali ke versi sebelumnya
pnpm --filter @pi-core/web exec wrangler rollback <VERSION_ID> --env staging
pnpm --filter @pi-core/api exec wrangler rollback <VERSION_ID> --env staging
```

---

## 3. Deploy ke PRODUKSI (gerbang persetujuan)

> Aturan keras: deploy produksi dan migrasi produksi **hanya** setelah persetujuan eksplisit pemilik
> di percakapan. Jangan pernah dijalankan otomatis.

Keputusan pemilik (2026-10-21, ADR-0019): **tidak ada project Supabase baru, bucket R2 baru, atau
pasukan Worker baru.** Produksi memakai database, Hyperdrive, dan bucket yang sudah ada, lalu dibuka di
`core.pmkitera.web.id` dan `api.core.pmkitera.web.id`.

### 3.0 Yang harus dipahami lebih dulu: database-nya satu

Produksi dan URL `workers.dev` menunjuk **baris data yang sama**. Artinya:

- Setiap percobaan di URL uji adalah data sungguhan. Tidak ada "data staging" untuk disembunyikan.
- Migrasi hanya dijalankan sekali, langsung ke data asli, dan praktis tidak bisa dibatalkan. Jalankan
  dulu di Postgres lokal, dan **backup sebelum migrasi** (`docs/OPERATIONS.md` §6).
- Satu-satunya jaring pengaman adalah backup + rollback versi Worker, bukan "kembali ke environment lain".

### 3.1 Prasyarat DNS: zona harus pindah ke Cloudflare

Ini bagian yang tidak bisa dilewati. Custom domain Worker hanya bekerja bila **nameserver** domain
diarahkan ke Cloudflare. Kondisi `pmkitera.web.id` pada 2026-10-21:

| Yang diperiksa | Hasil |
|---|---|
| Nameserver | `nsid1-4.rumahweb.*` (Rumahweb, bukan Cloudflare) |
| `pmkitera.web.id` (apex) | `216.198.79.1` — Vercel |
| `www.pmkitera.web.id` | CNAME ke `*.vercel-dns-017.com` — Vercel |
| `form.pmkitera.web.id` | CNAME ke `*.vercel-dns-017.com` — Vercel |
| MX / TXT | **tidak ada** (domain ini tidak dipakai untuk email) |
| `core.` dan `api.core.` | belum ada record |

Karena tidak ada MX/TXT, risiko pindah nameserver hanya soal web. Langkahnya:

1. Cloudflare dashboard → **Add a site** → `pmkitera.web.id` → pakai plan **Free**.
2. Cloudflare menyalin record yang terdeteksi. **Cocokkan manual** dengan tabel di atas, dan buat
   record Vercel sebagai **DNS only** (awan abu-abu, bukan oranye) supaya sertifikat tetap di Vercel:
   - `A  @    216.198.79.1` (DNS only)
   - `CNAME  www  727575dc1622d2f4.vercel-dns-017.com` (DNS only)
   - `CNAME  form 719527a5f707eded.vercel-dns-017.com` (DNS only)
3. Cloudflare memberi dua nameserver. Di panel Rumahweb, ganti NS domain ke keduanya.
4. Tunggu propagasi (biasanya < 1 jam). Cek: `dig +short NS pmkitera.web.id` harus menampilkan
   `*.ns.cloudflare.com`.
5. Pastikan situs lama masih hidup: `https://pmkitera.web.id` dan `https://form.pmkitera.web.id`.

Sampai langkah ini selesai, `wrangler deploy --env production` akan gagal dengan pesan bahwa zona tidak
ditemukan. Itu bukan bug konfigurasi.

### 3.2 Resource: tidak ada yang perlu dibuat

| Kebutuhan | Pakai yang sudah ada |
|---|---|
| Database | project Supabase yang sama, lewat Hyperdrive `afcb66f59a424787b5117c596edd29dc` |
| Foto | bucket R2 `pmk-core-avatars` |
| Worker | `pi-core-api` dan `pi-core-web` (dibuat oleh deploy pertama) |

Konfigurasi produksi sudah ditulis dan sudah lulus pemeriksaan struktur (`pnpm check:production
--skip-secrets`). Yang menandai database bersama secara eksplisit adalah `"DATA_PLANE": "shared"` di
`apps/api/wrangler.jsonc` — kalau tanda itu dihapus, preflight menolak (sudah diuji).

### 3.3 Secret (5 nama, nilainya tidak pernah tampil) **[tertulis]**

Diisi **setelah** Worker produksi ada:

```bash
pnpm --filter @pi-core/api exec wrangler secret put BETTER_AUTH_SECRET   --env production
pnpm --filter @pi-core/api exec wrangler secret put GOOGLE_CLIENT_ID     --env production
pnpm --filter @pi-core/api exec wrangler secret put GOOGLE_CLIENT_SECRET --env production
pnpm --filter @pi-core/api exec wrangler secret put R2_ACCESS_KEY_ID     --env production
pnpm --filter @pi-core/api exec wrangler secret put R2_SECRET_ACCESS_KEY --env production

pnpm --filter @pi-core/api exec wrangler secret list --env production   # cek nama saja
```

`BETTER_AUTH_SECRET` sebaiknya **berbeda** dari yang dipakai URL uji: kalau sama, sesi cookie yang dibuat
di URL uji juga sah di domain produksi.

### 3.4 Google Cloud Console **[tertulis]**

Tambahkan ke OAuth client (jangan hapus yang lama dulu):

- Authorized redirect URI: `https://api.core.pmkitera.web.id/api/auth/callback/google`
- Authorized JavaScript origin: `https://core.pmkitera.web.id`

### 3.5 Preflight — jangan deploy sebelum ini lulus **[terbukti]**

```bash
pnpm check:production
```

Script ini hanya membaca konfigurasi dan **nama** secret (tidak pernah nilainya), lalu menolak bila:

- salah satu Worker tidak punya route custom domain;
- `BETTER_AUTH_URL` bukan host API, atau `CORS_ORIGINS` tidak memuat host web;
- ada variabel produksi yang masih menyebut `staging` atau `REPLACE`;
- Hyperdrive id masih placeholder, atau sama dengan staging tanpa `DATA_PLANE: "shared"`;
- salah satu dari 5 secret belum ada (termasuk saat Worker produksi belum pernah dibuat).

Sekarang ia berhenti di: **Worker produksi belum ada**. Itu memang langkah berikutnya.

### 3.6 Urutan deploy

```bash
# 1. Backup database dulu (docs/OPERATIONS.md §6)
# 2. Migrasi schema produksi (docs/OPERATIONS.md §3)
# 3. API
pnpm --filter @pi-core/api exec wrangler deploy --env production
# 4. Web — the API origin is baked into the bundle, so it must be passed at build time
ENVIRONMENT=production NEXT_PUBLIC_API_URL=https://api.core.pmkitera.web.id \
  pnpm --filter @pi-core/web build:worker
pnpm --filter @pi-core/web exec wrangler deploy --env production
```

`next.config.ts` **menolak** build bila `ENVIRONMENT=production` tetapi `NEXT_PUBLIC_API_URL` tidak
diisi: tanpa itu bundle produksi akan memanggil API staging, dan CSP-nya hanya mengizinkan origin
staging. **[terbukti]** — pemeriksaan ini ditambahkan setelah menemukan bahwa build staging memang
mengandalkan nilai default.

### 3.7 Checklist setelah deploy produksi

- [ ] `https://api.core.pmkitera.web.id/api/v1/health` → 200
- [ ] `https://core.pmkitera.web.id` termuat, dan kartu statistik berisi angka (bukan "—")
- [ ] Login Google dengan akun ITERA sungguhan berhasil, dan peran muncul benar
- [ ] Satu percobaan **ditolak** juga dicek (mis. akun tanpa izin membuka `/peran` → pesan penolakan)
- [ ] `/audit-log` mencatat aksi yang baru dilakukan
- [ ] Tidak ada error di `wrangler tail --env production`
- [ ] CPU time di bawah batas plan (lihat "Masalah umum" no. 6)
- [ ] Situs lama tetap hidup: `pmkitera.web.id` dan `form.pmkitera.web.id`

### 3.8 Menutup jalur lama (setelah produksi terbukti jalan)

Setelah semua di atas lulus, Worker lama dihapus supaya hanya ada satu pasang dan tidak ada jalur kedua
yang menulis ke database yang sama. **Langkah ini butuh persetujuan Anda** (menghapus resource):

```bash
pnpm --filter @pi-core/api exec wrangler delete --name pi-core-api-staging
pnpm --filter @pi-core/web exec wrangler delete --name pi-core-web-staging
```

Worker tidak menyimpan data — data ada di Supabase dan R2 — jadi yang hilang hanya versi kode lama yang
masih bisa di-deploy ulang dari git kapan saja.

---

## 4. Aplikasi Android

Seluruh perintah di bawah **[terbukti]** di mesin ini (JDK 21, SDK 36).

### 4.1 Build APK untuk uji di HP

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install
cd android
export ANDROID_HOME="$HOME/Android/Sdk"
./gradlew assembleRelease          # ±3 menit; JS bundle ikut di dalam APK
```

Hasil: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` (±68 MB).

Untuk build yang menunjuk domain produksi (bukan URL uji), alamat API ditanam saat build **[terbukti]**:

```bash
EXPO_PUBLIC_API_URL=https://api.core.pmkitera.web.id ./gradlew clean assembleRelease
```

Pitfall yang benar-benar terjadi di sini: Gradle menganggap task bundling "up-to-date" karena perubahan
variabel environment **tidak** terhitung sebagai input task. `assembleRelease` tanpa `clean` menyelesaikan
build dalam 14 detik dan **APK-nya masih memanggil URL lama**. `clean` (atau
`--rerun-tasks`) memaksa JS bundle dibuat ulang; setelah itu bundle berisi
`api.core.pmkitera.web.id` dan tidak lagi memuat `workers.dev` (sudah dicek dengan `strings` pada bundle).

Cara memastikan sendiri setelah build:

```bash
unzip -p app/build/outputs/apk/release/app-release.apk assets/index.android.bundle \
  | strings | grep -o "[a-z0-9.-]*pmkitera[a-z0-9./-]*" | sort -u
```

Tanpa `EXPO_PUBLIC_API_URL`, aplikasi memakai default di `apps/mobile/src/config.ts` (URL `workers.dev`) —
masih berfungsi, tapi bukan alamat yang Anda bagikan ke anggota.

Catatan penting:

- `prebuild` **mengubah** `apps/mobile/package.json` (`android`/`ios` jadi `expo run:*`). Kembalikan
  dengan `git checkout apps/mobile/package.json` — folder `android/` dihasilkan ulang, tidak masuk git.
- APK ini ditandatangani **keystore debug**. Bisa dipasang di HP mana pun, **tidak** bisa diunggah ke
  Play Store.
- APK `debug` (bukan release) butuh Metro berjalan; pakai `assembleRelease` kalau ingin berdiri sendiri.

### 4.2 Pasang di HP

Lewat kabel (USB debugging aktif):

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Atau kirim file APK-nya ke HP (WhatsApp/Drive/kabel) lalu buka — Android akan meminta izin
"install unknown apps".

APK & AAB yang sudah jadi ada di `~/Documents/pi-core-artifacts/`.

### 4.3 Build AAB untuk Play Store

```bash
cd apps/mobile/android
./gradlew bundleRelease
# → app/build/outputs/bundle/release/app-release.aab (±48 MB)
```

Sebelum diunggah, AAB harus ditandatangani **release keystore** milik Anda (bukan debug):

```bash
keytool -genkeypair -v -keystore pmk-core-release.keystore -alias pmk-core \
        -keyalg RSA -keysize 4096 -validity 10000
```

Simpan file itu **dan** kedua password-nya di luar repo (password manager + salinan offline).
Kalau hilang, aplikasi tidak bisa di-update lagi dengan listing yang sama.

Cara menyambungkannya ke build ada di `docs/OPERATIONS.md` §8.3 (via `keystore.properties` yang
di-gitignore, atau lewat EAS credentials).

### 4.4 Unggah ke Play Store

1. Daftar Play Console (biaya sekali USD 25).
2. Buat aplikasi → unggah AAB → mulai dari **Internal testing**.
3. Lengkapi data safety, URL kebijakan privasi, screenshot, ikon, deskripsi.
4. Naikkan `versionCode` di setiap unggahan (`android/app/build.gradle`), dan `expo.version` di
   `apps/mobile/app.json`.

Alternatif tanpa Gradle lokal: `eas build --profile production` lalu `eas submit -p android`
(`apps/mobile/eas.json` sudah menyiapkan profil `preview` = APK dan `production` = AAB).

### 4.5 iOS

Belum bisa dari mesin ini: build iOS butuh macOS + Xcode (atau EAS cloud), dan distribusi butuh
Apple Developer berbayar (USD 99/tahun) — ADR-0004 memutuskan tidak memakai akun berbayar. iOS
statusnya target development/simulator saja.

---

## 5. Masalah umum dan penyebabnya

| Gejala | Sebab yang paling sering | Tindakan |
|---|---|---|
| 1. Halaman web kosong, konsol: `Minified React error #527 … 19.2.3 / 19.3.1` | versi `react` dan `react-dom` berbeda | pin keduanya ke versi yang sama (Expo SDK 57 → `19.2.3`), `pnpm install`, build ulang |
| 2. Semua `/api/v1/*` menjawab 401 padahal sudah login | token kedaluwarsa, atau cookie state hilang karena sign-in dimulai dari origin lain | login ulang dari halaman yang sama; sign-in harus dimulai di origin API (`/sign-in`) |
| 3. Browser menolak memanggil API (CSP) | `NEXT_PUBLIC_API_URL` tidak sama dengan origin API | samakan nilainya di `apps/web/.env` (atau var Worker), build ulang |
| 4. `wrangler deploy --env production` gagal / salah data | `env.production` masih placeholder atau menunjuk staging | `pnpm check:production`, perbaiki yang ditunjuk |
| 5. Setelah deploy web, perubahan tidak muncul | lupa `build:worker` | jalankan `build:worker` sebelum `wrangler deploy` |
| 6. API gagal saat trafik naik, log `exceededCpu` | batas CPU plan (Free: 10 ms/request) | cek `wrangler tail`; kalau konsisten di atas batas, naikkan plan (butuh persetujuan Anda) |
| 7. Angka di dashboard/daftar terlihat "0" padahal ada data | request gagal (403/401), bukan data kosong | lihat pesan di kartu ("Tidak dapat dimuat") dan cek izin peran |
| 8. `expo prebuild` mengubah `package.json` | perilaku normal Expo | `git checkout apps/mobile/package.json` |

---

## 6. Yang belum diverifikasi (jujur)

- Deploy **produksi** belum pernah dijalankan; resource produksi belum ada.
- Login Google dengan akun sungguhan di HP belum pernah diselesaikan (butuh akun ITERA Anda).
- Perintah yang bertanda **[tertulis]** (membuat Hyperdrive, bucket R2, `wrangler secret put`,
  `wrangler login`) belum dijalankan untuk proyek ini.
- Angka-angka dashboard yang sudah dihitung server belum pernah dilihat terisi dengan sesi nyata.

Kalau salah satu langkah di atas gagal, kirim pesan error-nya apa adanya — jangan kirim nilai secret.
