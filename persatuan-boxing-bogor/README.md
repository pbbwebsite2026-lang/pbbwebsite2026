# Website Persatuan Boxing Bogor + CMS

Proyek ini mengembangkan paket website HTML yang diberikan menjadi website multi-halaman dengan CMS awal, fungsi Netlify, sumber konten bersama, dan dokumentasi. Desain visual gelap-atletis dipertahankan dan identitas statis disesuaikan menjadi Persatuan Boxing Bogor. Identitas resmi (alamat, WhatsApp, email, Instagram, TikTok) dan logo sudah diisi di v1.2.4; pelatih, program, dan jadwal resmi tetap kosong sampai diisi pemilik.

## Isi proyek
- Website publik: beranda, program, pelatih, jadwal, galeri, kontak/pendaftaran.
- `data/content.json`: data publik yang dibaca website.
- `admin/`: dashboard CMS berbahasa Indonesia dengan pencarian/filter konten.
- `netlify/functions/cms-api.mjs`: login sesi dan baca/tulis konten ke GitHub Contents API.
- `netlify/functions/contact.mjs`: endpoint formulir; mengirim ke `CONTACT_WEBHOOK_URL` bila dikonfigurasi.

## Penting: batasan versi ini
- CMS menyimpan identitas, program, pelatih, jadwal, dan metadata galeri ke satu berkas JSON di GitHub. Perubahan commit ke branch yang dikonfigurasi dapat memicu Netlify deploy jika integrasi GitHub-Netlify sudah aktif.
- Login memakai satu password administrator dari environment variable; bukan sistem multi-admin. Pembatasan login di memori fungsi serverless bukan rate-limit terdistribusi dan tidak menggantikan proteksi edge/WAF.
- Upload foto galeri dari dashboard mendukung JPEG, PNG, dan WebP hingga 4 MB. Berkas di-commit ke `uploads/` melalui GitHub Contents API dan dapat memicu deployment terpisah dari penyimpanan metadata galeri.
- Preview draft menggunakan data draft di localStorage browser yang sama dan menampilkan pita pratinjau. Preview tidak mengubah konten publik.
- Status deployment dapat dibaca dari Netlify API jika `NETLIFY_AUTH_TOKEN` dan `NETLIFY_SITE_ID` diatur di environment server-side.
- Pengiriman formulir tidak berfungsi sampai `CONTACT_WEBHOOK_URL` HTTPS dikonfigurasi. Tanpa konfigurasi, endpoint sengaja mengembalikan status gagal yang jujur.
- Integrasi GitHub/Netlify nyata, uji browser/aksesibilitas menyeluruh, audit keamanan eksternal, dan deployment produksi belum diverifikasi.
- Data awal sengaja kosong. Pastikan seluruh profil, jadwal, foto, alamat, kontak, klaim, dan statistik diverifikasi sebelum tayang.

## Menjalankan lokal
1. Instal Node.js LTS.
2. Jalankan `npm test`, `npm run check`, dan `npm run build`.
3. Untuk tampilan statis, jalankan `python -m http.server 8000` lalu buka `http://localhost:8000`.
4. Fungsi Netlify dan CMS memerlukan Netlify CLI atau deployment Netlify serta environment variables yang benar; server statis biasa tidak menjalankan functions.

## Konfigurasi Netlify
- Build command: `npm run build`
- Publish directory: `.`
- Functions directory: `netlify/functions`
- Hubungkan repository GitHub dan branch yang sama dengan `GITHUB_BRANCH`.
- Tambahkan variabel dari `.env.example` di Netlify Site configuration → Environment variables. Jangan masukkan secret ke frontend, file JSON, atau chat.
- `GITHUB_TOKEN` harus token fine-grained dengan akses **Contents: Read and write** hanya ke repository ini. Hindari token organisasi atau izin yang tidak diperlukan.
- `CMS_SESSION_SECRET` harus berupa secret acak kuat. `CMS_ADMIN_PASSWORD` harus kata sandi unik yang kuat. Jangan gunakan contoh atau kata sandi yang sama dengan akun lain.
- `CONTACT_WEBHOOK_URL` opsional; gunakan hanya endpoint HTTPS terpercaya yang memang disiapkan untuk menerima permintaan formulir.

## Apakah CMS berada di dalam website?
Ya, CMS diakses melalui halaman admin terpisah di domain website: `https://DOMAIN-ANDA/admin/`. Pengunjung biasa tidak melihat panel ini dari navigasi publik. Anda tidak perlu mengedit HTML/JavaScript setiap kali ingin mengganti teks, program, pelatih, jadwal, atau galeri.

**Penting tentang cara kerja versi sekarang:** panel admin adalah antarmuka di website, tetapi data konten masih disimpan sebagai `data/content.json` di repository GitHub. Tombol **Simpan perubahan** membuat commit melalui backend; jika GitHub terhubung ke Netlify, commit itu memicu deployment. Jadi pembaruan dilakukan lewat CMS, bukan mengedit kode manual, tetapi publikasi masih bergantung pada pipeline GitHub/Netlify.

## Menggunakan CMS
1. Buka `/admin/` pada domain Netlify.
2. Masukkan password admin yang diatur di environment variables.
3. Pilih menu Identitas organisasi, Program, Pelatih, Jadwal, atau Galeri.
4. Tambahkan/edit item dan tekan **Simpan perubahan**. Sistem mengirim data ke server, lalu membuat commit ke `data/content.json` di GitHub.
5. Bila terjadi konflik, muat ulang data dan ulangi perubahan dengan hati-hati.
6. Jika GitHub menerima commit dan repository terhubung ke Netlify, build dapat dimulai. CMS dapat memeriksa deployment terbaru melalui tombol **Periksa status sekarang** jika `NETLIFY_AUTH_TOKEN` dan `NETLIFY_SITE_ID` sudah diatur.

## Rencana platform organisasi (fondasi database)
Folder `supabase/migrations/` sekarang berisi rancangan skema awal untuk profil pengguna, sasana, profil publik atlet yang terpisah dari detail privat, pendaftaran, kompetisi, kategori, peserta, pertandingan, dan audit log. Ini **baru migration file yang disiapkan**, belum diterapkan ke proyek Supabase mana pun, belum dihubungkan ke panel admin, dan belum menggantikan penyimpanan JSON/GitHub yang digunakan CMS saat ini.

Sebelum mengaktifkannya: buat proyek Supabase milik organisasi, tinjau dan jalankan migration di lingkungan staging, siapkan autentikasi dan role admin dengan proses bootstrap aman, uji seluruh Row Level Security, lakukan backup/restore drill, lalu baru implementasikan API dan UI untuk tiap modul. Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di frontend. Detail data anak/atlet dan dokumen privat tidak boleh dipublikasikan secara default.

## Struktur data jadwal
Status yang dikenali: `available`, `full`, `cancelled`, `closed`. Jam selesai harus setelah jam mulai. Program/pelatih terkait menggunakan ID item dan referensi yang tidak valid ditolak server.

## Privasi dan keamanan
Formulir mengirim nama, kontak, pengalaman, tujuan, dan pesan ke endpoint yang dikonfigurasi. Jangan memasukkan informasi sensitif. Endpoint webhook eksternal harus dipercaya dan memiliki kebijakan penyimpanan data yang sesuai. Jangan pernah membagikan token/password. Periksa log tanpa menyalin secret.

## Perintah pemeriksaan
- `npm test` — unit tests sederhana.
- `npm run check` — pemeriksaan sintaks fungsi.
- `npm run build` — pemeriksaan struktur dan JSON, **bukan bundling frontend**.

Laporan pengujian tersedia pada `TEST-REPORT.md`; temuan, tindakan, dan release blocker tercatat pada `AUDIT-REPORT-ID.md`.


## Catatan audit dan peningkatan

- Pratinjau draft menggunakan penyimpanan lokal browser dan menampilkan pita penanda draft; draft tidak dipublikasikan ke pengunjung lain. Gunakan tab/peramban yang sama untuk melihatnya.
- Unggah foto galeri mendukung JPEG, PNG, dan WebP dengan batas 4 MB agar permintaan tetap berada di batas praktis fungsi serverless. Foto disimpan ke folder `uploads/` di branch GitHub terkonfigurasi; unggahan foto membuat commit tersendiri dan dapat memicu deployment.
- API CMS memeriksa asal permintaan, batas ukuran request, kolom yang diizinkan, ID duplikat, status, kapasitas, dan referensi jadwal ke program/pelatih.
- Status deployment dapat dibaca dari Netlify API jika `NETLIFY_AUTH_TOKEN` dan `NETLIFY_SITE_ID` dikonfigurasi server-side.
- Rate limit login masih berbasis memori proses serverless; untuk perlindungan konsisten lintas instance/serangan terdistribusi, tambahkan penyimpanan rate-limit terkelola sebelum penggunaan produksi skala besar.
- `npm run build` saat ini merupakan pemeriksaan struktur, bukan bundling frontend.


## Premium Frontend Motion Upgrade (v4)

- Public pages now load Barba.js and declare a shared `data-barba="wrapper"` / `data-barba="container"` contract.
- GSAP drives a high-contrast red/black curtain transition, entry animation, scroll reveals, marquee, and coach-card parallax.
- The v4 homepage boxing glove was replaced in v8 by the kinetic artwork engine described in the next section.
- CMS rendering is callable after Barba swaps a page, so the next page's content is re-rendered without relying on a hard refresh.
- The existing coach images are not automatically cut out into transparent PNGs. That requires real coach photos and image processing; this upgrade instead adds a layered parallax treatment to CMS-provided portraits and never invents coach photos.

GSAP, ScrollTrigger, Barba.js, Lenis and the Three.js r128 stack are loaded from version-pinned CDN URLs (cdnjs / jsDelivr); they are not bundled locally. A live browser pass, mobile visual review, accessibility audit, CDN/network-failure check, and Netlify deployment verification are still required before production sign-off.

## Kinetic Digital Artwork (v8)

The front-end presentation layer is rewritten around one WebGL canvas that stays alive across Barba page changes. Files: `index.html`, `assets/js/kinetic.js`, `assets/css/style.css`.

- **Structure** — `#boxing-canvas-container` sits directly under `<body>`. Header, `main` and footer live inside the absolute `#interactive-ui-layer` (also the Barba wrapper). Typography is `pointer-events:none`; links, buttons and inputs keep `pointer-events:auto`, so pointer vectors reach the canvas. The brand title sits in `.kinetic-slot` (`data-kinetic-title="PERSATUAN|BOXING|BOGOR"`) and is the visible fallback when WebGL is off.
- **Engine** — Three.js r128: extruded, tessellated `TextGeometry` title with a custom vertex shader (`u_mouse`, `u_velocity`, `u_time`; 3.0-unit radius and `u_velocity > 1.2` gate); a damped harmonic spring (custom GSAP ease) returns the vertices to the origin grid; `EffectComposer` runs `RenderPass` then a chromatic-aberration shockwave `ShaderPass` (a click spikes `u_distortion` to 0.06 and decays it in 0.45 s with `elastic.out`); `playProceduralPunchSound` synthesizes the hit with the Web Audio API (no audio files); a 60 fps accumulator plus adaptive resolution protects the frame rate.
- **Camera rail** — every Barba navigation slides the camera to that page's station. Stations are generated from `data/content.json`: programs become heavy bags, schedule becomes a 24 h dial, events become a bracket, gallery photos become frames, coaches become pillars. With no coaches the station shows an empty ring; nothing is invented.
- **Style** — onyx `#0a0a0c`, neon red `#ff2a4b`, cyber blue `#00f0ff`. Legacy variable names (`--ink`, `--paper`, `--muted`, `--line`, `--display`, `--body`) stay as aliases for other pages and the admin inline styles.
- **Fallbacks** — no WebGL, a failed CDN, or `prefers-reduced-motion` make `kinetic.js` exit early and the static layout stays in charge. The CMS switch `kineticSound` still mutes the punch sound. Tuning knobs live in `CONFIG` at the top of `kinetic.js`.
- **Verification** — shaders were compiled and rendered in real WebGL1/WebGL2, and the engine logic was exercised against a stand-in for Three.js/GSAP (the build sandbox was offline). A live browser pass with the real CDN builds is still required before production sign-off.

## Supabase dan modul organisasi
Panduan setup dari nol ada di `docs/PANDUAN-SUPABASE-DARI-NOL-ID.md`. Migration SQL dijalankan berurutan: `202610100001_organization_platform_foundation.sql`, lalu `202610100002_integrity_hardening.sql`. Kedua migration belum dijalankan ke instance Supabase; fitur data atlet/pendaftaran/kompetisi belum operasional dan CMS konten tetap memakai GitHub JSON.


## Modul organisasi (v1.2.3)
- CMS konten publik: `/admin/` (penyimpanan GitHub JSON).
- Data organisasi: `/admin/platform.html` (atlet, sasana, pendaftaran, kompetisi, kategori, peserta, pertandingan) memerlukan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di environment server Netlify serta dua migration SQL yang sudah dijalankan dan `PLATFORM_ADMIN_PASSWORD` khusus yang berbeda dari password CMS.
- Agenda publik: `/competitions.html` menampilkan kompetisi berstatus publik.
- Integrasi belum dapat dianggap live sebelum proyek Supabase tersedia dan tes integrasi/RLS dilakukan.

- v1.2.5: teks situs diseragamkan ke Bahasa Indonesia, tombol "Kirim lewat WhatsApp" di formulir kontak (cadangan saat webhook belum aktif), favicon, dan tag Open Graph. Catatan: og:image memakai path relatif; setelah domain final ada, ubah ke URL absolut agar preview tampil di WhatsApp/Instagram.

- v1.2.6: build Netlify otomatis mengisi og:image dengan URL absolut dari domain situs (env URL bawaan Netlify), jadi tidak perlu diubah manual saat domain berganti.

- v5 (1.5.0): transisi crossfade halus, data awal terisi dari aset pemilik, poster pada event, "Event terdekat" di beranda, blok Supabase di halaman Event disembunyikan sampai aktif. Lihat `AUDIT-V5-ID.md`.

- v6 (1.6.0): visi-misi terisi, video sorotan pertandingan di beranda (diatur lewat Identitas organisasi di admin), kontrol jeda dan suara. Lihat `AUDIT-V6-ID.md`.

- v8: lapisan tampilan ditulis ulang menjadi karya kinetik (`index.html`, `assets/js/kinetic.js`, `assets/css/style.css`). Lihat bagian "Kinetic Digital Artwork (v8)".
