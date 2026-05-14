# Styling Rules (Patokan Halaman Karyawan)

Dokumen ini berisi panduan *styling* UI (Tailwind CSS classes) berdasarkan standar yang telah diterapkan pada halaman Karyawan (`src/pages/employees/index.tsx` dan komponen terkait). Gunakan panduan ini untuk menjaga konsistensi desain di seluruh aplikasi.

## 1. Tabel (Table)

Tabel dirancang dengan tampilan bersih, menggunakan *sticky header* dan *horizontal scroll* jika kolom terlalu banyak.

**Container Tabel:**
```tsx
<div className="relative border rounded-md bg-white flex flex-col">
  <div className="overflow-x-auto overflow-y-visible flex-1 h-auto relative">
    {/* Table tag */}
  </div>
</div>
```

**Tag Table Element:**
```tsx
<table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[1200px]">
```

**Table Header (Header Bar):**
`TableHeader` menggunakan background `muted` dan menempel (sticky) agar tetap terlihat saat di-scroll.
```tsx
<TableHeader className="z-20 transition-none [&_th]:sticky [&_th]:top-[var(--sticky-offset)] [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted">
```

**Table Head (Header Columns):**
Gunakan `text-left` untuk data teks (Nama, Jabatan, Alamat, dll) dan `text-center` untuk data pendek/angka (No, Unit, Pendidikan, Status).
```tsx
<TableHead className="font-semibold text-center whitespace-nowrap">Kolom Pendek</TableHead>
<TableHead className="font-semibold text-left whitespace-nowrap">Kolom Teks</TableHead>
```
> *Catatan: Jangan gunakan `border-r` pada header untuk menjaga tampilan tetap bersih (clean). Gunakan `whitespace-nowrap` agar judul kolom tidak turun ke bawah.*

**Table Row (Baris Data):**
```tsx
<TableRow className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm">
```

**Table Cell (Isi Sel):**
```tsx
<TableCell className="text-slate-900 py-1.5 truncate max-w-[150px]">Isi Data</TableCell>
```

---

## 2. Form Dialog (Tambah/Edit)

Dialog untuk form (*Create/Edit*) menggunakan layout vertikal dengan bagian *Header*, *Body (Scrollable)*, dan *Footer (Fixed)*.

**Dialog Content Container:**
```tsx
<DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
```

**Dialog Header:**
```tsx
<DialogHeader className="p-6 border-b bg-muted/30">
  <DialogTitle className="text-xl font-bold tracking-tight">Judul Dialog</DialogTitle>
</DialogHeader>
```

**Form Body Container (Bagian yang bisa di-scroll):**
```tsx
<form className="flex flex-col flex-1 overflow-hidden">
  <div className="flex-1 overflow-y-auto p-6 space-y-10">
    {/* Isi Form Input Di Sini */}
  </div>
  {/* Footer */}
</form>
```

**Layout Kategori / Section Form:**
Gunakan pemisah visual (`border-l-2`) dan judul kecil (*uppercase*) jika input dikelompokkan:
```tsx
<div className="space-y-4">
  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
    <div className="h-4 w-1 bg-primary rounded-full"></div>
    Nama Kategori (Contoh: Informasi Pribadi)
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3 border-l-2 border-muted/50 py-1">
    {/* Kumpulan Input */}
  </div>
</div>
```

**Input & Label:**
Tinggi input konsisten di `h-9` dengan font `text-sm`, dan teks label tebal dengan warna `text-muted-foreground/90`.
```tsx
<div className="space-y-2">
  <Label className="text-sm text-muted-foreground/90 font-bold">Label Text</Label>
  <Input className="h-9 text-sm text-slate-900 shadow-sm" />
  {/* Atau untuk Select */}
  {/* <SelectTrigger className="h-9 text-sm text-slate-900 shadow-sm"> */}
</div>
```

**Dialog Footer (Tombol Aksi di Bawah):**
```tsx
<div className="p-6 border-t bg-muted/30 flex justify-end gap-3">
  {/* Tombol Cancel dan Submit */}
</div>
```

---

## 3. Tombol (Buttons)

Tombol utama dan sekunder ditempatkan bersama, misal pada bagian header halaman atau footer dialog.

### A. Tombol Tambah (Primary Action)
Gunakan warna `primary`, dengan efek bayangan dan transisi klik (aktif turun `scale-95`).
```tsx
<Button 
  size="sm" 
  className="gap-2 shadow-md shadow-primary/10 bg-primary hover:bg-primary/90 transition-all transform active:scale-95 font-medium"
>
  <Plus className="h-4 w-4" /> Tambah
</Button>
```

Khusus untuk **Tombol Submit di Footer Form**:
```tsx
<Button 
  type="submit" 
  className="min-w-[140px] h-10 shadow-md bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-all transform active:scale-95 px-6"
>
  Simpan Data
</Button>
```

### B. Tombol Pendukung di Samping Tambah (Contoh: Export/Filter)
Gunakan *variant outline* dengan efek background putih pudar dan tulisan yang menyatu. Tombol tidak mencolok tapi tetap berkesan premium.
```tsx
<Button 
  variant="outline" 
  size="sm" 
  className="gap-2 bg-white/50 shadow-sm border-primary/20 transition-all font-medium"
>
  <Download className="h-4 w-4 text-primary" /> Export
</Button>
```

Khusus untuk **Tombol Batal di Footer Form**:
```tsx
<Button 
  type="button" 
  variant="outline" 
  className="min-w-[140px] h-10 text-sm"
>
  Batal
</Button>
```

---

## 4. Navigation Tabs

Tab digunakan untuk membagi konten di dalam satu halaman atau komponen tanpa perlu berpindah haluan. Layout container disesuaikan menggunakan sistem *grid* agar lebarnya seragam.

**Struktur Komponen Tabs:**
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="grid grid-cols-3 mb-3 bg-muted/50 h-9 rounded-lg">
    <TabsTrigger value="personal" className="text-xs">Pribadi</TabsTrigger>
    <TabsTrigger value="contact" className="text-xs">Kontak</TabsTrigger>
    <TabsTrigger value="employment" className="text-xs">Kepegawaian</TabsTrigger>
  </TabsList>
  
  {/* Diikuti oleh konten tabel atau <TabsContent> */}
</Tabs>
```

**Panduan Class Tailwind pada Tabs:**
- **TabsList**: Gunakan `grid grid-cols-[jumlah-tab]` (misal: `grid-cols-3`), beri margin bawah `mb-3`, warna dasar abu-abu redup `bg-muted/50`, tinggi presisi `h-9`, dan kelengkungan `rounded-lg`.
- **TabsTrigger**: Gunakan `text-xs` (atau `text-sm`) untuk label agar ukurannya pas di dalam container `h-9` tanpa berpotensi bergeser.

---

## 5. Status Badges (Premium Palette)

Gunakan palet warna HSL "Sophisticated Traffic Light" untuk memberikan kesan premium namun tetap informatif. Jangan gunakan gaya `uppercase`.

**Ukuran Badge di Tabel:**
`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap`

**Variasi Warna:**
*   **Hadir / Aktif / Disetujui (Positive - Hijau Forest):**
    `text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]`
*   **Telat / Pending / Izin (Warning - Amber Gold):**
    `text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]`
*   **Mangkir / Ditolak / Nonaktif (Negative - Deep Crimson):**
    `text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]`
*   **Role / Info Penting (Neutral - Navy):**
    `text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]`

---

## 6. Summary Containers (Statistik Header)

Container untuk menampilkan ringkasan data di atas tabel (seperti di tab Presensi).

**Container Luar:**
`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/20 border rounded-lg mb-4`

**Kotak Statistik (Box):**
Gunakan `h-9` agar tingginya sinkron dengan input filter/tombol di sekitarnya.
`px-3 h-9 flex items-center rounded-md text-xs font-semibold border`
*(Gunakan variasi warna yang sama dengan Status Badges di atas)*.

---

## 7. Jarak Antar Elemen (Spacing)

Untuk menjaga konsistensi kepadatan informasi:
- Gunakan `space-y-4` antara Container Statistik/Filter dan Tabel Utama.
- Gunakan `py-1.5` pada `TableCell` agar baris tabel tidak terlalu tebal.
- Gunakan `gap-2` antar badge atau tombol kecil yang berjejer.
