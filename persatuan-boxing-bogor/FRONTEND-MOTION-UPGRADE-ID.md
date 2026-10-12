# Catatan Upgrade Frontend Motion — v4.1.2

Upgrade ini mempertahankan struktur CMS dan desain yang ada, dengan fokus pada ketahanan navigasi Barba, aksesibilitas fokus pasca-navigasi, dan ketahanan pesan status formulir.

## Perubahan

- Tautan anchor/hash pada dokumen yang sama dibiarkan memakai perilaku native browser.
- `aria-busy` menandai wrapper selama transisi Barba dan dibersihkan setelah hook `after`.
- Fokus dipindahkan ke kontainer utama halaman baru menggunakan `focus({ preventScroll: true })` agar pengguna keyboard dan pembaca layar mengetahui konteks halaman baru.
- Formulir tetap mengunci pengiriman ganda dan tidak melempar error bila elemen `.form-result` tidak tersedia.
- Tes regresi bertambah menjadi 24 tes.

## Status

Tes otomatis, pemeriksaan sintaks, dan structural build check lulus. Pengujian browser interaktif belum selesai karena Chromium headless timeout di lingkungan audit. Status rilis tetap HOLD sampai browser QA dan tes deployment nyata berhasil.
