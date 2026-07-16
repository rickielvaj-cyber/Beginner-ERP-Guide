# Catatan Belajar ERP YonSuite

Situs statis pribadi untuk catatan belajar YonSuite ERP (PT Yonyou Network Indonesia) — Digital Modeling, AACT/COA, Purchasing, Sales, Inventory, AP, AR, Fixed Asset, Inventory Accounting, GL, dan Issue Log troubleshooting.

**Live site:** diaktifkan lewat GitHub Pages (lihat Settings → Pages di repo ini).

## Struktur

```
index.html              shell aplikasi (sidebar, search, router)
assets/css/style.css     semua styling (palet warna korporat biru YonSuite)
assets/js/app.js         routing, render markdown, search, filter issue log
assets/js/vendor/marked.js   markdown parser (MIT, https://github.com/markedjs/marked)
content/manifest.json    daftar modul, urutan belajar, kategori issue log
content/*.md             satu file markdown per modul
content/images/<slug>/   screenshot per modul
```

## Cara nambah / update konten

Situs ini merender markdown langsung di browser (tidak ada build step) — tinggal edit,
commit, push, dan GitHub Pages otomatis update.

- **Update catatan modul yang sudah ada:** edit langsung file `content/<slug>.md`.
- **Tambah modul baru:**
  1. Buat file baru `content/<slug-baru>.md`.
  2. Tambahkan entri baru di `content/manifest.json` (`modules` dan `learningPath`).
- **Tambah entri Issue Log baru:** buka `content/issue-log.md`, copy salah satu blok
  `<div class="issue-card" data-category="...">...</div>` yang sudah ada, taruh di kategori
  yang sesuai. Kategori valid: `sequencing`, `setup`, `cancel-undo`, `konfigurasi`, `authorization`.
- **Tambah gambar/screenshot:** taruh file image di `content/images/<slug>/`, referensikan
  di markdown dengan `![alt](images/<slug>/nama-file.png)`.

## Menjalankan lokal

Situs ini murni HTML/CSS/JS statis, tidak butuh build tool. Jalankan server statis apa saja, contoh:

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`.

## Palet warna & tema

Pengunjung bisa pilih tema sendiri lewat tombol **Tema** di topbar: warna (Merah/Yonyou
atau Biru) x mode (Terang/Gelap/Ikuti Sistem) — 4 kombinasi total, tersimpan di
localStorage browser masing-masing. Semua warna didefinisikan sebagai CSS custom
properties di `assets/css/style.css` (4 blok `:root[data-palette=...][data-theme=...]`),
gampang disesuaikan atau ditambah palet baru di situ.

## Kalau situs kelihatan belum ke-update setelah push

Browser kadang nge-cache `app.js`/`style.css` versi lama walau `index.html` sudah baru.
Kalau ganti isi `assets/js/app.js` atau `assets/css/style.css` dan situsnya kelihatan
belum berubah setelah push + hard refresh, naikkan angka `?v=` di tag `<link>`/`<script>`
pada `index.html` (misal `?v=3` → `?v=4`) — itu maksa browser ambil file yang baru.
