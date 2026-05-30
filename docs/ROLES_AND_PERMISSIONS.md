# Dokumentasi Role-Based Access Control (RBAC) HRIS

Dokumen ini menjelaskan arsitektur hierarki peran (Role) pada sistem HRIS multi-cabang (multi-tenant) ini. Pemahaman yang konsisten terhadap aturan ini sangat penting agar tidak terjadi kebocoran data antar-cabang maupun kesalahan kalkulasi statistik karyawan.

## Struktur Tabel Terkait
Sistem peran bergantung pada kombinasi 2 tabel utama:
- `employees`: Berisi profil data diri karyawan, status keaktifan (`active`, `on_leave`, `resigned`), dan tempat cabang mereka didaftarkan (`instansi_id`).
- `user_roles`: Berisi hak akses yang dimiliki oleh seorang akun (dihubungkan via `user_id`). Satu akun bisa saja memiliki lebih dari satu peran di cabang yang berbeda.

---

## 1. Peran Level Cabang (Spesifik Instansi)
Peran-peran ini **WAJIB** memiliki `instansi_id` di dalam tabel `user_roles`. Mereka hanya memiliki hak dan terhitung secara statistik di dalam cabang tersebut.

| Role | Deskripsi & Batasan Akses | Dihitung sebagai "Karyawan Aktif"? |
|---|---|---|
| `employee` | Karyawan biasa. Hanya bisa melihat *dashboard* miliknya sendiri, melakukan presensi, melihat kinerja pribadi, dan mengajukan cuti. | **YA** |
| `unit_leader` | Kepala unit/divisi. Bisa melihat *dashboard* manajerial spesifik untuk unitnya, menyetujui/menolak cuti bawahan, dan menilai KPI bawahan. | **YA** |
| `hr` | Human Resources cabang. Bisa mengelola semua karyawan, jadwal, cuti, presensi, dan KPI **hanya di cabang tersebut**. | **TIDAK** (Fokus Manajerial) |

*Catatan: `employee` dan `unit_leader` adalah satu-satunya entitas yang disaring dan dihitung pada angka "Karyawan Aktif" di seluruh widget dashboard.*

---

## 2. Peran Level Global (Lintas Cabang / Pusat)
Peran-peran ini **TIDAK BOLEH** diikat pada cabang tertentu (`instansi_id` harus `NULL` di tabel `user_roles`). Mereka berhak mengakses, memantau, dan mengubah data di seluruh cabang yang terdaftar di dalam sistem.

| Role | Deskripsi & Batasan Akses | Dihitung sebagai "Karyawan Aktif"? |
|---|---|---|
| `director` | Jajaran direksi pusat. Fokus pada laporan komprehensif, analitik antar-cabang, dan persetujuan yang bersifat krusial/tingkat tinggi. | **TIDAK** |
| `super_admin` | Pemilik/Administrator IT. Memiliki hak absolut atas keseluruhan sistem, termasuk konfigurasi cabang baru, manajemen admin/HR cabang, dan database pusat. | **TIDAK** |

---

## Panduan Penanganan Masalah (Troubleshooting)
Jika terdapat perbedaan angka statistik karyawan aktif antara Mode Cabang vs Mode Semua Cabang (Global), periksa hal berikut:
1. Pastikan karyawan manajerial (`hr`, `director`, `super_admin`) tidak secara tidak sengaja terdaftar sebagai `employee` di tabel profil tanpa diselaraskan dengan tabel `user_roles`.
2. Pastikan nilai `instansi_id` untuk `super_admin` dan `director` dibiarkan kosong (`NULL`).
3. Karyawan yang sedang berstatus `on_leave` (Cuti) atau `inactive` di tabel `employees` tidak akan masuk ke dalam hitungan total karyawan aktif, meski peran mereka adalah `employee`.
