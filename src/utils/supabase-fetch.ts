import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Wrapper for database queries to prevent UI freezing (infinite "Memuat..." states)
 * caused by Supabase session deadlocks when tokens expire or network abruptly drops.
 */
export async function supabaseFetchWithTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number = 60000 // Increased to 60s for better background tab compatibility
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      // Only reject if the tab is visible. If hidden, ignore timeout for now as browser might be throttling.
      if (document.visibilityState === "visible") {
        reject(new Error("Supabase_Timeout"));
      } else {
        // If hidden, we don't reject yet. We'll let it stay pending or wait until visible.
        console.log("SupabaseFetch: Request prolonged in background, but ignoring timeout while hidden.");
      }
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } catch (err: any) {
    // If it timed out, we check if it's a real issue
    if (err.message === "Supabase_Timeout") {
      console.warn("SupabaseFetch: Request timed out after 60s.");
      // We don't force logout anymore. Just notify.
      toast.error("Koneksi tidak stabil. Jika data tidak muncul, silakan segarkan halaman.", {
        description: "Permintaan data membutuhkan waktu lebih lama dari biasanya."
      });
    } else {
      console.error("Fetch Data Error:", err);
      // Handle actual Auth failures (JWT expired)
      if (err?.code === "PGRST301" || err?.message?.includes("JWT") || err?.status === 401) {
         console.warn("Auth Session Expired. Redirecting to login...");
         toast.error("Sesi telah berakhir. Silakan masuk kembali.");
         
         // Only redirect if we are not already at login
         if (window.location.pathname !== "/login") {
           setTimeout(() => {
             supabase.auth.signOut().then(() => {
               localStorage.clear();
               sessionStorage.clear();
               window.location.href = "/login";
             });
           }, 2000);
         }
      }
    }
    throw err;
  } finally {
    if (timeoutId!) clearTimeout(timeoutId);
  }
}
