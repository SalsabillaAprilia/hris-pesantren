import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Wrapper for database queries to prevent UI freezing (infinite "Memuat..." states)
 * caused by Supabase session deadlocks when tokens expire or network abruptly drops.
 */
export async function supabaseFetchWithTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number = 8000
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Supabase_Timeout"));
    }, timeoutMs);
  });

  try {
    // Proactively refresh the session before the query to prevent deadlocks
    await Promise.race([supabase.auth.getSession(), timeoutPromise]);

    // Proceed to execute the actual query alongside the timeout clock
    const result = await Promise.race([promise, timeoutPromise]);
    
    return result;
  } catch (err: any) {
    if (err.message === "Supabase_Timeout") {
      toast.error("Koneksi bermasalah atau sesi kedaluwarsa. Menyegarkan perangkat...", { duration: 3000 });
      // Beri sedikit jeda agar user sempat membaca pesan sebelum hard refresh
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      console.error("Fetch Data Error:", err);
      // Optional JWT handling if Supabase passes up the specific auth 401 error code
      if (err?.code === "PGRST301" || err?.message?.includes("JWT")) {
         toast.error("Sesi otentikasi telah berakhir. Silakan masuk kembali.");
         setTimeout(() => {
           supabase.auth.signOut().then(() => window.location.href = "/login");
         }, 1500);
      }
    }
    throw err;
  } finally {
    clearTimeout(timeoutId!);
  }
}
