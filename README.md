# HRIS Pesantren

Sistem Informasi Manajemen SDM Pesantren (Human Resource Information System / HRIS) terintegrasi yang dirancang khusus untuk memenuhi kebutuhan manajemen staf, guru, dan pengurus di lingkungan pesantren. Proyek ini dikembangkan sebagai bagian dari tugas mata kuliah Proyek Pemrograman 3.

## Fitur Utama
*(Daftar fitur dapat disesuaikan dengan perkembangan proyek)*
- Manajemen Data Pegawai/Pengajar
- Manajemen Presensi dan Jadwal
- (Tambahkan fitur lainnya)

## Persyaratan Sistem
Pastikan Anda telah menginstal *tools* berikut sebelum menjalankan proyek:
- [Node.js](https://nodejs.org/) (versi 18.x atau lebih baru disarankan)
- [npm](https://www.npmjs.com/) sebagai *package manager*
- Git

## Panduan Instalasi dan Menjalankan Proyek (Local Development)

Ikuti langkah-langkah berikut untuk meng-clone dan menjalankan proyek ini di mesin lokal Anda:

1. **Clone Repository ini**
   Buka terminal atau command prompt, lalu jalankan perintah berikut:
   ```bash
   git clone https://github.com/your-username/hris-pesantren.git
   cd hris-pesantren
   ```

2. **Instalasi Dependencies**
   Instal semua paket yang dibutuhkan proyek menggunakan `npm`:
   ```bash
   npm install
   ```

3. **Menjalankan Development Server**
   Setelah semua dependensi terinstal, jalankan perintah ini untuk memulai *local server*:
   ```bash
   npm run dev
   ```

4. **Akses Aplikasi**
   Buka *browser* Anda dan kunjungi URL yang muncul di terminal.

## Struktur Proyek
Proyek ini dibangun menggunakan *stack* web modern (React/Vite, TailwindCSS) dan menggunakan Supabase sebagai *backend-as-a-service*. Backend dan konfigurasi autentikasi di-*handle* melalui folder `supabase/`.
