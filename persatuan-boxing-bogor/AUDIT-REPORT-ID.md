# Audit Lanjutan Persatuan Boxing Bogor — v4

## Baseline

Upgrade dilanjutkan dari ZIP terbaru v3. Perubahan difokuskan pada pengalaman frontend dan tidak mengganti CMS/API dengan backend baru.

## Temuan dan perbaikan

- Navigasi lintas halaman kini memakai Barba.js dengan kontrak container pada seluruh halaman publik dan transisi tirai beranimasi GSAP.
- Renderer konten CMS diekspos sebagai fungsi yang dapat dipanggil setelah pergantian container, untuk menghindari halaman yang kosong/stale setelah navigasi SPA-style.
- Hero memakai sarung tinju 3D prosedural dari Three.js yang mengikuti pointer dan memberi aksen momentum berdasarkan scroll. Library dimuat sesuai kebutuhan di halaman yang memiliki hero.
- Sistem visual dibuat lebih brutalist melalui display type besar, marquee, aksen glitch, transisi berkontras tinggi, serta layer parallax untuk kartu pelatih.
- `prefers-reduced-motion`, fokus keyboard, dan fallback CSS dipertahankan sebagai jalur aksesibilitas/resiliensi.
- Data program/pelatih/jadwal/galeri tetap CMS-driven; tidak ada foto pelatih atau informasi operasional fiktif yang ditambahkan.

## Penyempurnaan audit lanjutan v4

- Micro-interactions tombol/tautan dibatasi pada kontrol tindakan, dengan reset transform saat pointer keluar dan pengamanan event cleanup untuk jab sarung tinju.
- Efek glitch otomatis saat pointer sekadar melewati judul atau menu dihapus untuk menjaga keterbacaan dan mengurangi gerakan tak terduga.
- Ditambahkan fokus keyboard yang jelas serta aturan reduced-motion untuk animasi/transisi CSS.
- Pemeriksaan ulang: 18 tes otomatis lulus; `npm run check` dan `npm run build` lulus. Chromium headless kembali dicoba tetapi gagal berjalan stabil di lingkungan audit, jadi pengujian browser tetap belum terverifikasi.

## Hal yang belum bisa diklaim

- Belum ada konfirmasi visual dari browser karena sesi Chromium headless timeout.
- Belum ada integrasi GitHub/Netlify live yang diverifikasi.
- Belum ada Lighthouse, audit aksesibilitas manual, uji perangkat fisik, atau penetration test.
- PNG cut-out memerlukan foto sumber pelatih asli; tidak dibuat tanpa aset sumber.

Lihat `FRONTEND-MOTION-UPGRADE-ID.md` untuk rincian implementasi dan `TEST-REPORT.md` untuk status pengujian.
