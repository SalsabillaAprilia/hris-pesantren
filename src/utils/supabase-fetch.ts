import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper untuk query database agar tidak freeze di state "Memuat..." selamanya.
 *
 * Perubahan dari versi sebelumnya:
 * - Tidak ada toast dari sini. Semua notifikasi error dihandle oleh pemanggil (halaman/komponen).
 * - Ini mencegah "double toast" dan toast palsu dari request halaman lama yang sudah di-navigate.
 * - Satu-satunya exception: redirect ke /login saat JWT kedaluwarsa (bukan notifikasi, tapi aksi keamanan).
 */
export async function supabaseFetchWithTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number = 30000
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Supabase_Timeout"));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } catch (err: any) {
    if (err.message === "Supabase_Timeout") {
      // Hanya log, tidak tampilkan toast. Halaman pemanggil yang akan handle UI-nya.
      console.warn(`SupabaseFetch: Request timed out after ${timeoutMs}ms.`);
    } else {
      console.error("Fetch Data Error:", err);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId!);
  }
}
