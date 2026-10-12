# Audit v3 — Persatuan Boxing Bogor

## Diperbaiki
- **Konten CMS tidak muncul saat halaman dibuka langsung** (refresh, link WhatsApp, Google): baris hasil render CMS tetap `opacity:0` karena animasi dipasang sebelum data tiba. Kini animasi dipasang ulang setelah konten selesai render, ditambah pengaman 3,5 detik.
- **Halaman Tentang & Visi Misi** (`about.html`) baru, diisi dari menu admin **Tentang & Visi Misi**.
- **Event** dikelola dari menu admin **Event** dan tampil di halaman Event (sebelumnya hanya bergantung pada Supabase yang belum terhubung).
- **Judul tab halaman Kompetisi** berubah menjadi "Website | …" setelah konten dimuat; sudah diperbaiki.
- **Transisi:** loader hanya tampil sekali per sesi, halaman tujuan dimuat lebih awal saat kursor/jari mendekat, animasi judul tidak berulang, `/admin` tidak lagi dibawa lewat transisi Barba, CSS Lenis resmi menggantikan `scroll-behavior:smooth` yang bentrok.
- **Keterbacaan:** teks 7–11 px dinaikkan (isi 15–17 px, label min. 12 px), kontras abu-abu diperbaiki, input formulir 16 px (mencegah zoom otomatis iPhone), menu hamburger mulai ≤1000 px agar 8 menu tidak menumpuk.
- **Bahasa:** label kursor Inggris (VIEW, JOIN THE CAMP) diganti Indonesia; istilah "camp" di admin diganti "organisasi"; menu: Beranda, Tentang, Program, Pelatih, Jadwal, Event, Galeri, Daftar sekarang.
- **Zona waktu:** tanggal event selalu WIB.
- Footer kini menampilkan Facebook, peta, dan jam operasional jika diisi di admin (sebelumnya field ada tetapi tidak pernah tampil).
- Ditambah `404.html`, `robots.txt`, dan `sitemap.xml` (dibuat otomatis saat build Netlify).

## Belum dikerjakan / perlu keputusan pemilik
- **Visi & misi resmi sengaja dikosongkan.** Teks karangan tidak boleh tampil sebagai pernyataan resmi organisasi. Isi lewat admin.
- Program, pelatih, jadwal, dan event masih kosong (menunggu data resmi).
- Formulir kontak butuh `CONTACT_WEBHOOK_URL`; tanpa itu tombol WhatsApp menjadi jalur utama.
- Library (GSAP, Barba, Lenis, Three.js) masih dari CDN tanpa SRI; self-host disarankan sebelum lomba.
- Belum diuji di browser sungguhan (hanya tes otomatis dan DOM tiruan). Cek manual: iPhone Safari, Android Chrome, koneksi lambat.

## v1.4 — panggung hero dan kenyamanan ponsel
- Hero: sarung tangan 3D generik diganti **foto pertandingan asli** (duotone merah-hitam) + **tali ring interaktif** (bergetar mengikuti kursor dan scroll) + timer ronde 3 menit. WebGL tidak lagi dimuat secara default (hemat ±600 KB dan beban GPU di ponsel).
- Tombol utama hero kini **Daftar sekarang**; info lokasi dan WhatsApp tampil langsung di hero; bilah aksi cepat (Daftar, WhatsApp) tetap terlihat di ponsel.
- Loader dan transisi dipersingkat (kriteria juri: loader lama dan animasi di bawah 60 fps mengurangi skor Usability).
