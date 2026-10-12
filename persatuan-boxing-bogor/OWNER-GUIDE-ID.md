# Panduan Pemilik — Persatuan Boxing Bogor

## Apakah perlu mengedit kode untuk update?
Tidak untuk update konten yang sudah didukung CMS. Buka domain website lalu tambahkan `/admin/` (contoh `https://DOMAIN-ANDA/admin/`) dan masuk dengan kata sandi admin. Panel admin terpisah dari halaman publik, tetapi masih berada di website yang sama. Edit data di sana lalu tekan **Simpan perubahan**. Versi sekarang menyimpan konten ke file JSON di repository GitHub; Netlify kemudian perlu menjalankan deployment agar pengunjung melihat versi terbaru. Perubahan struktur/fitur baru tetap memerlukan perubahan kode dan deployment.

## Masuk
Buka `https://DOMAIN-ANDA/admin/` lalu masukkan kata sandi administrator yang disiapkan saat konfigurasi. Jika gagal, periksa apakah variabel `CMS_ADMIN_PASSWORD` dan `CMS_SESSION_SECRET` sudah diatur di Netlify. Jangan mengirim kata sandi kepada siapa pun.

## Mengubah identitas organisasi
Pilih **Identitas organisasi**, ubah nama, slogan, deskripsi, alamat, kontak, jam operasional, dan informasi SEO. Kosongkan informasi yang belum resmi. Tekan **Simpan perubahan**.

## Program, pelatih, dan jadwal
Pilih menu yang sesuai lalu tekan **Tambah**. Isi data sebenarnya, simpan item, kemudian tekan **Simpan perubahan** pada halaman. Edit untuk memperbarui; Salin membuat entri baru; Sembunyikan membuat item tidak tampil; Hapus menghapus item dari data setelah perubahan disimpan. Periksa ulang jadwal sebelum publikasi.

## Galeri
CMS versi saat ini memiliki alur unggah foto JPEG/PNG/WebP maksimal 4 MB melalui backend, kemudian menyimpan berkas ke repository GitHub. Unggahan foto dan penyimpanan metadata galeri merupakan dua langkah terpisah. Jangan mengunggah foto orang tanpa izin yang sesuai.

## Publikasi
Penyimpanan ke GitHub berbeda dari status deployment. Setelah data tersimpan, buka Netlify → Deploys untuk melihat apakah build dimulai, berhasil, atau gagal. Status deployment dapat diperiksa dari dashboard CMS melalui tombol **Periksa status sekarang** jika variabel Netlify telah dikonfigurasi.

## Jika ada masalah
- **Gagal masuk:** periksa environment variables Netlify dan coba lagi.
- **Gagal menyimpan:** pastikan token GitHub masih aktif dan punya akses Contents read/write pada repository yang benar.
- **Konten belum berubah:** periksa Netlify Deploys; pastikan deployment berhasil dan branch yang digunakan sesuai.
- **Formulir gagal:** `CONTACT_WEBHOOK_URL` harus dikonfigurasi. Tanpa layanan penerima, permintaan tidak disimpan atau dikirim.
- **Foto tidak muncul:** periksa alamat/path foto dan apakah file dapat diakses publik.

Untuk meminta bantuan teknis, bagikan pesan error yang sudah disensor. Jangan bagikan password, token, cookie sesi, atau isi environment variable.


### Pratinjau draft dan foto

- Tombol **Pratinjau draft** membuka tampilan lokal di browser yang sama dan menampilkan pita kuning penanda pratinjau. Draft tidak dipublikasikan sampai tombol **Simpan perubahan** digunakan dan commit GitHub berhasil.
- Pada menu **Galeri**, pilih **Tambah**, pilih foto JPEG/PNG/WebP maksimal 4 MB, tunggu pesan berhasil, lengkapi teks alternatif, lalu simpan item dan tekan **Simpan perubahan**. Unggah file dan penyimpanan data galeri merupakan dua langkah terpisah.


### Memeriksa status deployment

Pada bagian **Status publikasi**, tekan **Periksa status sekarang**. Untuk menampilkan status langsung dari Netlify, pengelola teknis perlu mengisi `NETLIFY_AUTH_TOKEN` dan `NETLIFY_SITE_ID` di pengaturan environment Netlify. Token tidak boleh dimasukkan ke konten CMS atau dikirim lewat chat.


## Transisi dan animasi frontend

Halaman publik menggunakan Barba.js untuk transisi antarkonten tanpa reload penuh, GSAP untuk tirai transisi/parallax, dan Three.js untuk karya 3D kinetik: judul 3D "PERSATUAN BOXING BOGOR" di beranda yang bereaksi pada gerakan dan klik mouse, serta kamera yang meluncur antar halaman. Pustaka dimuat melalui CDN, jadi koneksi internet dan kebijakan CSP harus mengizinkannya. Jika animasi tidak tampil, navigasi HTML biasa tetap menjadi jalur cadangan; uji juga saat CDN diblokir dan pada perangkat dengan `prefers-reduced-motion`.


## Modul atlet dan kompetisi
Panel `/admin/platform.html` kini menyediakan operasi tambah/lihat/perbarui untuk atlet, sasana, pendaftaran, kompetisi, kategori, peserta, pertandingan, dan hasil melalui Supabase. Panel ini memakai password admin data yang berbeda dari password CMS dan memerlukan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, serta `PLATFORM_ADMIN_PASSWORD` di environment server Netlify. Migration SQL tetap harus diterapkan secara berurutan ke proyek Supabase terlebih dahulu. Integrasi belum dianggap operasional sebelum uji CRUD, audit log, RLS, browser, dan deployment berhasil. Jangan masukkan data pribadi atlet asli sebelum uji tersebut lulus.

## Menyiapkan Supabase dari nol
Ikuti `docs/PANDUAN-SUPABASE-DARI-NOL-ID.md`. Jalankan migration pertama lalu kedua hanya setelah meninjau isinya. Panduan ini tidak berarti proyek Supabase sudah dibuat atau website sudah terhubung. Halaman publik `/competitions.html` menampilkan hanya kompetisi yang sudah dipublikasikan setelah Supabase terhubung. CMS konten lama tetap menggunakan GitHub JSON. Jangan pernah menaruh service-role key di browser, ZIP, GitHub, atau chat.

## Tentang, Visi Misi, dan Event
Buka menu **Tentang & Visi Misi** untuk mengisi visi, misi, profil, nilai, dan langkah bergabung (satu poin per baris). Bagian yang kosong tampil sebagai "akan dipublikasikan pengurus". Buka menu **Event** untuk menambah agenda; event tampil di halaman Event.


## Teks Beranda & Efek Kinetik (v7)
Di CMS buka menu **Teks Beranda**. Di sana Anda mengubah judul beranda (pakai tanda `|` untuk pindah baris; tampil sebagai teks besar di bawah judul 3D "PERSATUAN BOXING BOGOR"), teks kecil, teks berjalan, bagian filosofi, kutipan, ajakan bergabung, teks footer, dan saklar suara pukulan. Tekan **Simpan perubahan**, lalu tunggu deployment Netlify selesai. Efek 3D membutuhkan internet (CDN Three.js/GSAP) dan otomatis mati jika pengunjung memakai mode "kurangi gerakan". Adegan 3D membaca data CMS: jumlah program, jam jadwal, event, foto galeri, dan pelatih. Jika pelatih belum diisi, adegan hanya menampilkan ring kosong; tidak ada nama yang dikarang.


### Teks Halaman, Menu & Footer (v7.1)
Menu **Teks Halaman** di CMS memuat semua teks tetap: menu atas, footer, judul, paragraf, tombol, dan label formulir di setiap halaman. Teks aslinya tertulis di label tiap kolom. Ubah, tekan **Simpan perubahan**, lalu tunggu deployment Netlify selesai.
