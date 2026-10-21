# PI-CORE Agent Kit (untuk Hermes)

Dokumen untuk agent berbahasa Inggris (presisi). Penjelasan untuk pemilik = Indonesia.

## Cara pakai (sekali setup)
1. Buat repo kosong `pi-core` di GitHub, clone, lalu **salin seluruh isi kit ke root repo** (AGENTS.md, docs/, .agents/).
2. Pastikan Hermes membaca `AGENTS.md` di root proyek dan skill di `.agents/skills/` (menurut dokumentasi integrasi Hermes, project skills dibaca lewat
   `skills.external_dirs` yang menyertakan `.agents/skills/`; verifikasi dengan `hermes doctor`/dokumentasi, tambahkan di konfigurasi jika belum).
3. Siapkan Figma MCP di konfigurasi Hermes (`~/.hermes/config.yaml`, blok `mcp_servers`; cek format terbaru di dokumentasi Hermes).
4. **Pasang BMAD sekali** (interaktif, kamu yang menjalankan): di root repo jalankan `npx bmad-method install` (butuh Node 20+), pilih target **Hermes** dan modul pengembangan software (BMM). Jangan timpa folder `.agents/skills/` milik kit ini.
5. Jalankan Hermes di folder repo dan ketik: **`lanjutkan`**. Agent akan memeriksa instalasi BMAD, lalu menjalankan rantai perencanaan BMAD (PRD, UX, arsitektur, epic & story) memakai dokumen kit sebagai bahan, dan berhenti untuk review kamu di titik-titik persetujuan. Setelah itu ia mengerjakan story satu per satu.
   Kalau BMAD bermasalah, ubah `Mode: PHASES` di `docs/STATE.md` (jalur tanpa BMAD, memakai `docs/phases/`).

## Sesudah itu
- Setiap kali kamu ketik **`lanjutkan`**, agent membaca `docs/STATE.md`, menentukan sendiri langkah berikutnya, mengerjakannya, memperbarui STATE.md, lalu melapor (Bahasa Indonesia).
- Default: agent berhenti di akhir tiap fase supaya kamu bisa review. `lanjutkan` berikutnya = terima fase itu dan mulai fase selanjutnya.
- **`lanjutkan sampai selesai`** = agent boleh menyambung antar fase tanpa jeda review, tetap berhenti di persetujuan (produksi, resource berbayar, dll.).
- Kalau agent butuh sesuatu darimu (akses akun, OAuth client, keputusan), ia mengumpulkannya dalam satu pesan; setelah kamu jawab, ketik `lanjutkan` lagi.

## Deploy (website & aplikasi Android)
Baca **`docs/PANDUAN-DEPLOY.md`** — panduan langkah demi langkah dalam Bahasa Indonesia: deploy staging,
checklist produksi, build APK/AAB, dan masalah umum beserta penyebabnya. Manual operasional lengkap
(insiden, rotasi kunci, backup) ada di `docs/OPERATIONS.md`.

## Fallback jika Hermes tidak memuat AGENTS.md otomatis
Tempel pesan pertama ini sekali saja:
> Baca `AGENTS.md`, lalu ikuti bagian "CONTINUE PROTOCOL". Lanjutkan proyek PI-CORE sekarang.

## Yang perlu kamu siapkan (jangan kirim secret lewat chat)
Akun Cloudflare (+ DNS pmkitera.web.id di Cloudflare bila ingin custom domain), project Supabase staging (production nanti), repo GitHub, Google Cloud OAuth client.
Keputusan terbuka ada di `docs/ARCHITECTURE.md` bagian 10.

## Struktur
`AGENTS.md` · `docs/{ARCHITECTURE,SECURITY,DESIGN,ROADMAP,STATE,BMAD-INTEGRATION}.md` · `docs/phases/phase-0..6` · `docs/decisions/` (ADR) · `.agents/skills/*`
