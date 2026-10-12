# Laporan Pengujian — Persatuan Boxing Bogor Premium Audit v4.1.2

Tanggal: 10 Oktober 2026

## Hasil verifikasi yang dapat direproduksi

| Pemeriksaan | Hasil | Keterangan |
|---|---|---|
| `npm test` | PASS | 24 tes, 0 gagal |
| `npm run check` | PASS | Sintaks fungsi Netlify valid |
| `npm run build` | PASS | Pemeriksaan struktur, file wajib, JSON, link lokal, marker aksesibilitas dasar, dan sintaks JavaScript |
| `node --check assets/js/app.js` | PASS | Sintaks JavaScript frontend valid |
| Chromium headless screenshot | NOT COMPLETED | Percobaan lokal timeout setelah 25 detik; tidak dihitung sebagai lulus |
| Browser QA interaktif desktop/mobile | NOT RUN | Transisi, tombol kembali, responsive behavior dan form perlu uji nyata |
| CMS/contact end-to-end di Netlify | NOT RUN | Butuh deployment dan konfigurasi penerima yang nyata |
| WebGL di perangkat nyata | NOT RUN | GPU, memori, dan fallback perlu diverifikasi di perangkat sasaran |
| Lighthouse / audit aksesibilitas manual | NOT RUN | Belum ada hasil yang dapat diklaim |

## Perbaikan v4.1.2

- Barba mengecualikan tautan hash dalam dokumen yang sama agar perilaku anchor native tidak diganti transisi dokumen.
- Status `aria-busy` dipasang selama transisi dan dibersihkan setelah perpindahan selesai.
- Fokus keyboard/screen reader dipindahkan ke landmark main yang baru tanpa memicu scroll kedua.
- Pesan status form sekarang aman bila elemen status opsional tidak ada.
- Menambahkan 3 tes regresi untuk perilaku hash, fokus halaman, dan status formulir.

## Batasan

`npm run build` merupakan pemeriksaan struktural, bukan bundling atau validasi browser. Library GSAP, ScrollTrigger, Barba, Three.js, dan font eksternal membutuhkan akses CDN serta harus diuji terhadap kebijakan CSP/deployment. Jangan menganggap deployment, formulir end-to-end, atau browser QA lulus sebelum pengujian langsung dilakukan.

## Platform foundation pass — 2026-10-10
- Added a Supabase schema migration draft for organization profiles, clubs, athletes, private athlete details, registrations, competitions, categories, entries, matches, and audit logs.
- Added row-level security policies and separated private athlete details from public-consent athlete profiles.
- Tightened applicant registration insert policy to only permit submitted requests with reviewer-only fields unset.
- Updated owner documentation to clarify that CMS is accessed at `/admin/`, while current content persistence remains GitHub `data/content.json` + Netlify deployment.
- Added tests for schema/RLS presence and CMS architecture documentation.
- `npm test`: PASS (26 tests).
- `npm run check`: PASS.
- `npm run build`: PASS (structural check only).
- Not performed: SQL execution against Supabase, live auth/RLS integration, browser E2E, deployment validation. No claim of production readiness is made.

## Database schema integrity review — 2026-10-10
- Added server-side trigger guards so a competition entry cannot reference a category belonging to another competition.
- Added match guards so red/blue/winner entries must belong to the same competition and, when specified, the same category; the winner must be one of the two bout entries.
- Added static regression assertions for these constraints.
- These are source-level checks only; PostgreSQL execution is still pending a real staging project and must be verified there before production.

## Follow-up hardening v1.2.2 — 2026-10-10
- Added a second ordered Supabase migration to hide match rows that reference non-approved entries from public reads.
- Added a database trigger to require consistent core references for membership/competition registrations, timestamp maintenance triggers, and supporting indexes.
- Added `docs/PANDUAN-SUPABASE-DARI-NOL-ID.md` for project creation, sequential migration application, safe first-admin bootstrap, and key-handling boundaries.
- `npm test`: PASS (28 tests, 0 failures).
- `npm run check`: PASS.
- `npm run build`: PASS (structural check only).
- Not performed: execution against PostgreSQL/Supabase, actual RLS role-matrix tests, browser E2E, or live deployment. SQL changes remain unverified against a real database until the user creates a staging project.


## v1.2.3 — Modul data organisasi
- Ditambahkan panel `/admin/platform.html` untuk operasi tambah/lihat/perbarui pada atlet, sasana, pendaftaran, kompetisi, kategori, peserta, serta pertandingan/hasil.
- Endpoint memakai sesi khusus admin data, password terpisah, validasi field allowlist, batas percobaan login best-effort, dan service-role key hanya pada fungsi server.
- Ditambahkan halaman publik `/competitions.html` yang hanya meminta field publik untuk kompetisi terbit.
- CMS lama `/admin/` dan penyimpanan GitHub JSON tetap dipertahankan.
- Verifikasi lokal pada paket ini: 31 tes otomatis lulus, pemeriksaan sintaks backend lulus, pemeriksaan struktur 7 halaman publik lulus.
- Belum diverifikasi: migrasi SQL pada instance PostgreSQL/Supabase, operasi CRUD nyata, RLS langsung, audit log di database nyata, browser E2E, deployment Netlify, backup/restore. Jangan masukkan data asli sebelum tes integrasi dan keamanan tersebut dilakukan.
