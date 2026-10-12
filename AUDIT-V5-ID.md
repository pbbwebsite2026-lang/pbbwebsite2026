# Audit v5 — Persatuan Boxing Bogor

## Temuan v4 dan perbaikan
- Transisi berupa tirai merah penuh layar yang terasa sebagai perpindahan halaman. Diganti crossfade halus (header tetap, isi halaman memudar sekitar 0,6 detik) dengan tetap menghormati reduced-motion.
- Hampir semua koleksi data kosong, sehingga halaman tampil "belum tersedia". Kini terisi dari poster dan foto resmi yang dikirim pemilik: jadwal, 2 program, 2 event, 16 foto galeri, jam latihan, link peta.
- Halaman Event memuat blok "Agenda Pertandingan" dari Supabase yang belum aktif dan menampilkan pesan gagal ke pengunjung. Blok itu kini disembunyikan sampai ada data.
- Kartu event kini menampilkan poster dan deskripsi per baris. Beranda menampilkan "Event terdekat" otomatis (event aktif berikutnya) dan strip 4 foto dari galeri; keduanya dikelola dari CMS (urutan galeri, tanggal event).
- Jadwal diurutkan berdasarkan jam mulai.

## Masih perlu diisi pemilik
- Visi dan misi resmi (admin → Tentang & Visi Misi), data pelatih, serta tanggal dan lokasi AHK Road to School Vol. 2.
- Pastikan izin orang tua/wali untuk foto peserta di bawah umur.
- Foto bersumber dari poster/unggahan beresolusi sekitar 720 px; ganti dengan file asli agar tajam di layar besar.

## Belum diverifikasi
- Uji di browser sungguhan (desktop dan HP), Lighthouse, serta deployment Netlify dan GitHub. Render konten hanya diuji lewat simulasi DOM (jsdom). 41 tes otomatis, `npm run check`, dan `npm run build` lulus.
