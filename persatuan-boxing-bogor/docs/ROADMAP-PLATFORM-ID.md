# Roadmap Platform Persatuan Boxing Bogor

## Target
Website resmi dan pusat informasi organisasi, dengan panel administrasi yang nantinya mengelola konten, atlet, pendaftaran, dan kompetisi.

## Kondisi saat ini
- CMS konten berjalan melalui `/admin/` pada domain website.
- Data CMS publik masih disimpan di `data/content.json` pada repository GitHub.
- Backend CMS memakai Netlify Functions; perubahan konten membuat commit GitHub dan dapat memicu deployment Netlify.
- Supabase belum terhubung. Migration di `supabase/migrations/` hanya fondasi skema, bukan database aktif.
- Panel admin `/admin/platform.html` dan endpoint server-side untuk operasi dasar atlet, sasana, pendaftaran, kompetisi, kategori, peserta, dan pertandingan telah ditambahkan; memerlukan environment Supabase sebelum dapat digunakan.
- Halaman publik `/competitions.html` disiapkan untuk kompetisi yang telah dipublikasikan.
- Belum ada proyek Supabase terhubung; belum teruji integrasi nyata, alur akun Supabase Auth, formulir pendaftaran publik, atau pengujian RLS browser.

## Tahapan implementasi yang disyaratkan
1. **Keamanan dan environment:** autentikasi berbasis Supabase Auth atau penyedia identitas tepercaya, bootstrap admin yang aman, rate-limit terkelola, audit logging, backup dan pemulihan.
2. **Staging database:** buat proyek Supabase terpisah untuk staging; tinjau migration; terapkan; verifikasi RLS sebagai anon, member, coach, club manager, official, dan admin.
3. **API dan validasi:** semua perubahan status/approval/hasil wajib tervalidasi server-side. Jangan mempercayai role atau status yang dikirim klien.
4. **Modul atlet dan sasana:** pendaftaran, review, kepemilikan profil, consent publikasi, dan pemisahan data pribadi.
5. **Modul kompetisi:** kompetisi, kategori, entry, jadwal pertandingan, hasil, dan jejak koreksi.
6. **Integrasi admin:** navigasi admin dengan peran dan modul; data publik dibaca dari sumber database setelah migrasi disetujui.
7. **Migrasi data:** ekspor konten JSON, mapping/validasi, dry run, backup, cutover, dan rollback plan.
8. **Go-live gate:** tes unit, integration, RLS, browser desktop/mobile, backup restore, formulir, monitoring, dan pemeriksaan privasi.

## Batasan keamanan
- Jangan memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke HTML, JavaScript browser, atau file `data/`.
- Jangan mengumpulkan nomor identitas, tanggal lahir, data wali, atau dokumen kecuali benar-benar diperlukan dan ada prosedur akses/retensi yang jelas.
- Profil atlet publik harus opt-in melalui persetujuan publikasi dan hanya berisi field yang aman untuk umum.
- Jika atlet masih di bawah umur, tetapkan alur persetujuan wali dan kebijakan penghapusan sebelum peluncuran modul.
- Migration ini belum diuji pada instance Supabase dan tidak boleh dianggap bukti bahwa RLS sudah tervalidasi. Jalankan pengujian integrasi setelah proyek staging tersedia.

## CMS saat ini: cara update konten
Buka `https://DOMAIN-ANDA/admin/`, login, ubah data, lalu klik **Simpan perubahan**. Panel admin adalah bagian terpisah dari website yang sama; Anda tidak perlu mengedit HTML untuk konten yang sudah didukung. Data saat ini disimpan ke GitHub JSON dan deployment Netlify harus sukses agar perubahan tampil di publik. Fitur baru atau perubahan struktur tetap memerlukan pengembangan kode.
