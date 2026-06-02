/**
 * Utility untuk menerjemahkan error bawaan database/Supabase 
 * menjadi pesan Bahasa Indonesia yang ramah pengguna (Graceful Error Handling).
 */

export function formatError(error: any, fallbackMessage: string = "Terjadi kesalahan pada sistem"): string {
  if (!error) return fallbackMessage;

  // Jika error adalah string biasa
  const errMessage = typeof error === 'string' ? error : (error.message || error.error_description || "");
  const errCode = error.code || "";

  const msgLower = errMessage.toLowerCase();

  // 1. Tangani berdasarkan Kode Error Supabase / PostgreSQL
  switch (errCode) {
    case "23505": // Unique Violation (Duplicate)
      return "Data ini sudah ada (duplikat). Silakan gunakan data yang berbeda.";
    case "23503": // Foreign Key Violation (Masih terhubung)
      return "Tindakan ditolak. Data ini tidak bisa dihapus atau diubah karena masih digunakan oleh data lain.";
    case "23502": // Not Null Violation
    case "22P02": // Invalid Text Representation
      return "Format isian data tidak valid atau ada kolom wajib yang kosong.";
    case "42P01": // Undefined Table
      return "Tabel atau data yang dicari tidak ditemukan di dalam sistem.";
    case "PGRST116":
      return "Data spesifik yang Anda cari tidak ditemukan.";
  }

  // 2. Tangani berdasarkan Keyword di Message (Network / Auth / dll)
  if (msgLower.includes("failed to fetch") || msgLower.includes("network error")) {
    return "Koneksi internet terputus atau server sedang tidak dapat dijangkau.";
  }
  
  if (msgLower.includes("jwt expired") || msgLower.includes("invalid token")) {
    return "Sesi login Anda telah berakhir. Silakan muat ulang halaman atau login kembali.";
  }

  if (msgLower.includes("body stream already read")) {
    return "Terjadi masalah jaringan sesaat. Silakan coba lagi.";
  }

  // 3. Jika pesan aslinya sudah cukup sederhana/pendek, kita boleh tampilkan
  // Namun jika panjang dan teknis, kita timpa dengan fallback
  if (errMessage.length < 50 && !errMessage.includes("violates") && !errMessage.includes("syntax error")) {
    return errMessage;
  }

  return fallbackMessage;
}
