# Panduan Supabase dari Nol — Persatuan Boxing Bogor

Status: panduan persiapan. **Belum ada proyek Supabase yang terhubung.** Jangan masukkan data atlet asli sebelum kebijakan akses diuji.

## A. Buat proyek
1. Buka https://supabase.com/ lalu masuk/daftar akun.
2. Buat organisasi/proyek khusus Persatuan Boxing Bogor.
3. Pilih region yang sesuai kebutuhan, simpan password database di password manager, dan jangan masukkan password ke chat atau repository.
4. Tunggu proyek siap, lalu buka **Project Settings → API**. Catat Project URL dan publishable/anon key untuk konfigurasi aplikasi bila nanti diminta. Jangan pernah menaruh `service_role` key di browser, ZIP, GitHub, atau chat.
5. Aktifkan MFA untuk akun pemilik proyek dan batasi siapa yang menjadi anggota proyek.

## B. Terapkan migrasi secara berurutan
1. Buka **SQL Editor** di dashboard Supabase.
2. Tinjau lalu jalankan isi `supabase/migrations/202610100001_organization_platform_foundation.sql`.
3. Jika langkah pertama sukses, tinjau lalu jalankan `supabase/migrations/202610100002_integrity_hardening.sql`.
4. Jika salah satu gagal, berhenti dan simpan pesan error. Jangan menjalankan migration berikutnya seolah-olah langkah sebelumnya berhasil.
5. Periksa **Table Editor**: harus terlihat tabel profil, sasana, atlet, data privat atlet, pendaftaran, kompetisi, kategori, entri, pertandingan, dan audit log. Pastikan RLS aktif pada semua tabel.

## C. Admin pertama — jangan membuka pendaftaran admin publik
1. Buat akun melalui **Authentication → Users** menggunakan alamat email pengurus yang benar-benar dikuasai.
2. Salin UUID user tersebut dari dashboard.
3. Setelah memastikan UUID dan identitasnya, jalankan SQL berikut dengan mengganti placeholder secara manual. Jangan membagikan UUID atau kredensial di tempat publik:

```sql
insert into public.user_profiles (user_id, display_name, role, is_active)
values ('GANTI-DENGAN-UUID-USER-AUTH', 'Admin Persatuan Boxing Bogor', 'admin', true);
```

4. Verifikasi akun dapat masuk dan role-nya benar. Jangan memberi role admin kepada pendaftar biasa. Hindari membuat endpoint yang menerima role dari browser.

## D. Sebelum integrasi aplikasi
- Tetapkan kebijakan retensi, persetujuan publikasi profil atlet, akses data anak di bawah umur, serta siapa yang boleh melihat kontak wali dan kontak darurat.
- Gunakan data dummy terlebih dahulu; uji sebagai anon, member, coach, pengelola sasana, dan admin.
- Uji bahwa user biasa tidak dapat mengubah role, membaca detail privat atlet lain, menyetujui pendaftaran sendiri, atau mengubah hasil pertandingan.
- Aktifkan backup sesuai kemampuan paket, dan uji pemulihan sebelum menyimpan data organisasi.
- Jangan menyimpan kunci service-role di variabel frontend. Untuk operasi admin gunakan server-side function dengan validasi role yang ketat.

## E. Hubungkan panel admin ke Supabase (server Netlify)
1. Pada Netlify, buka **Site configuration → Environment variables**.
2. Tambahkan `SUPABASE_URL` berisi Project URL, `SUPABASE_SERVICE_ROLE_KEY` berisi service_role secret yang hanya digunakan server, dan `PLATFORM_ADMIN_PASSWORD` (minimal 16 karakter, berbeda dari password CMS). Jangan menaruh nilainya di `.env.example`, file frontend, atau percakapan.
3. Pastikan variabel hanya tersedia pada server/functions, lalu deploy ulang.
4. Buka `/admin/platform.html`, masuk dengan password CMS, lalu uji memakai data dummy dahulu.
5. Panel ini menyediakan operasi tambah/lihat/perbarui untuk atlet, sasana, pendaftaran, kompetisi, kategori, peserta, dan pertandingan. Penghapusan sengaja tidak disediakan. CMS konten lama tetap menggunakan GitHub JSON.
6. Halaman publik `/competitions.html` hanya menampilkan kompetisi dengan status publik. Sampai Supabase terhubung, halaman akan memberi tahu bahwa informasi belum tersedia.
7. Setelah tiap mutasi, periksa `audit_logs`. Jika pencatatan audit gagal, hentikan penggunaan data produksi dan perbaiki kebijakan audit terlebih dahulu.

## Batasan saat ini
Kode integrasi Supabase dan panel admin telah disiapkan, tetapi belum ada proyek Supabase yang terhubung sehingga operasi nyata belum dapat diverifikasi. CMS konten tetap memakai GitHub Contents API untuk `data/content.json`; CMS tersebut belum dipindahkan ke Supabase. Belum ada formulir pendaftaran publik, alur akun atlet/pengurus berbasis Supabase Auth, verifikasi browser, tes RLS pada instance nyata, atau uji pemulihan backup. Jangan masukkan data atlet asli atau menganggap sistem siap produksi sebelum semua tes itu lulus.
