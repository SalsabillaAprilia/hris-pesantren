import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type AppRole = "super_admin" | "hr" | "unit_leader" | "employee" | "director";

export type Institution = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
};

interface AuthContextType {
  user: User | null;
  employee: Tables<"employees"> | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdminOrHr: boolean;
  isSuperAdmin: boolean;
  isHr: boolean;
  isEmployee: boolean;
  isDirector: boolean;
  // Multi-Cabang: Identitas institusi user yang sedang login
  instansiId: string | null;           // instansi_id dari user_roles (NULL = akun Global)
  isGlobalRole: boolean;               // true jika instansiId === null
  currentInstitution: Institution | null; // Profil institusi yang sedang aktif (branding)
  allInstitutions: Institution[];      // Daftar semua institusi (hanya untuk akun Global)
  selectedInstansiId: string | null;   // Filter cabang yang dipilih akun Global
  setSelectedInstansiId: (id: string | null) => void;
  refreshInstitutions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Tables<"employees"> | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  // Ref ini memastikan setLoading(true) HANYA memblokir UI pada mount pertama.
  // Refresh berikutnya (akibat visibilitychange / TOKEN_REFRESHED) berjalan diam-diam
  // di background tanpa menghancurkan tampilan halaman yang sudah ada datanya.
  const isInitialLoad = useRef(true);

  // Multi-Cabang state
  const [instansiId, setInstansiId] = useState<string | null>(null);
  const [currentInstitution, setCurrentInstitution] = useState<Institution | null>(null);
  const [allInstitutions, setAllInstitutions] = useState<Institution[]>([]);
  const [selectedInstansiId, setSelectedInstansiId] = useState<string | null>(null);

  // Fetch institution profile by id (or first institution if global)
  const fetchInstitution = useCallback(async (id: string | null) => {
    try {
      if (id) {
        // Akun lokal: ambil profil institusinya sendiri
        const { data } = await supabaseFetchWithTimeout(
          supabase.from("institutions").select("*").eq("id", id).single(),
          10000
        );
        if (data) setCurrentInstitution(data as Institution);
      } else {
        // Akun Global: ambil semua institusi untuk Branch Selector
        const { data } = await supabaseFetchWithTimeout(
          supabase.from("institutions").select("*").order("name"),
          10000
        );
        if (data) setAllInstitutions(data as Institution[]);
        setCurrentInstitution(null); // Global tidak terikat 1 institusi
      }
    } catch (err) {
      console.error("Auth: Failed to fetch institution:", err);
    }
  }, []);

  const refreshInstitutions = useCallback(async () => {
    try {
      if (instansiId === null) {
        const { data } = await supabaseFetchWithTimeout(
          supabase.from("institutions").select("*").order("name"),
          10000
        );
        if (data) setAllInstitutions(data as Institution[]);
      } else {
        await fetchInstitution(instansiId);
      }
    } catch (err) {
      console.error("Auth: Failed to refresh institutions:", err);
    }
  }, [instansiId, fetchInstitution]);

  const refreshSession = async (force: boolean = false) => {
    const now = Date.now();
    
    if (!force && lastRefresh > 0 && (now - lastRefresh < 300000) && user && employee) {
      console.log("Auth: Session is fresh, skipping metadata fetch.");
      // Hanya set false jika ini masih initial load (state loading masih true)
      if (isInitialLoad.current) setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabaseFetchWithTimeout(supabase.auth.getSession(), 20000);
      const u = session?.user ?? null;
      
      if (u) {
        if (!employee || !roles.length || force || u.id !== user?.id) {
          console.log("Auth: Fetching profile metadata...");
          const [empRes, rolesRes] = await Promise.all([
            supabaseFetchWithTimeout(supabase.from("employees").select("*").eq("user_id", u.id).single(), 20000),
            supabaseFetchWithTimeout(supabase.from("user_roles").select("role, instansi_id").eq("user_id", u.id), 20000),
          ]);
          if (empRes?.data) {
            if (empRes.data.status === "inactive") {
              await supabase.auth.signOut();
              toast.error("Akses ditolak: Akun Anda telah dinonaktifkan.");
              setUser(null); setEmployee(null); setRoles([]);
              setLoading(false); return;
            }
            setEmployee(empRes.data);
          }
          if (rolesRes?.data) {
            setRoles(rolesRes.data.map((r) => r.role as AppRole) || []);
            // Ambil instansi_id dari row pertama user_roles
            const userInstansiId = rolesRes.data[0]?.instansi_id ?? null;
            setInstansiId(userInstansiId);
            await fetchInstitution(userInstansiId);
          }
        }
        
        setUser(u);
        setLastRefresh(now);
      } else {
        setUser(null); setEmployee(null); setRoles([]);
        setInstansiId(null); setCurrentInstitution(null);
      }
    } catch (err) {
      console.error("Auth: Session refresh failed:", err);
      if (!user) setUser(null); 
    } finally {
      // Selalu selesaikan loading state pada initial load.
      // Untuk refresh background (isInitialLoad sudah false), ini tidak berpengaruh
      // karena loading sudah false.
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    let visibilityTimeout: NodeJS.Timeout;

    refreshSession(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log("Auth Event:", event);
        
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null); setEmployee(null); setRoles([]);
          setInstansiId(null); setCurrentInstitution(null); setAllInstitutions([]);
          setSelectedInstansiId(null);
          setLoading(false); setLastRefresh(0);
          return;
        }

        const u = session.user;
        try {
          if (event === 'TOKEN_REFRESHED' && employee && u.id === user?.id) {
            setUser(u);
            return;
          }

          const [empRes, rolesRes] = await Promise.all([
            supabaseFetchWithTimeout(supabase.from("employees").select("*").eq("user_id", u.id).single(), 20000),
            supabaseFetchWithTimeout(supabase.from("user_roles").select("role, instansi_id").eq("user_id", u.id), 20000),
          ]);
          if (empRes?.data) {
            if (empRes.data.status === "inactive") {
              await supabase.auth.signOut();
              toast.error("Akses ditolak: Akun Anda telah dinonaktifkan.");
              setUser(null); setEmployee(null); setRoles([]);
              setLoading(false); return;
            }
            setEmployee(empRes.data);
          }
          if (rolesRes?.data) {
            setRoles(rolesRes.data.map((r) => r.role as AppRole) || []);
            const userInstansiId = rolesRes.data[0]?.instansi_id ?? null;
            setInstansiId(userInstansiId);
            await fetchInstitution(userInstansiId);
          }
          setUser(u);
          setLastRefresh(Date.now());
        } catch (err) {
          console.error("Auth: State change metadata fetch failed:", err);
          setUser(u); 
        } finally {
          setLoading(false);
        }
      }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && mounted) {
        clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
          console.log("Tab focused, performed smart refresh check.");
          refreshSession(false);
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(visibilityTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Ketika akun Global memilih cabang, update branding secara reaktif
  useEffect(() => {
    if (instansiId !== null) return; // Akun lokal, tidak perlu ini
    if (selectedInstansiId) {
      const inst = allInstitutions.find(i => i.id === selectedInstansiId) || null;
      setCurrentInstitution(inst);
    } else {
      setCurrentInstitution(null);
    }
  }, [selectedInstansiId, allInstitutions, instansiId]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
      ]);
    } catch (e) {
      console.warn("Force logout triggered");
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      setUser(null); setEmployee(null); setRoles([]);
      setInstansiId(null); setCurrentInstitution(null);
      window.location.href = "/login";
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isSuperAdmin = hasRole("super_admin");
  const isHr = hasRole("hr");
  const isDirector = hasRole("director");
  const isAdminOrHr = isSuperAdmin || isHr;
  const isEmployee = hasRole("employee") || hasRole("unit_leader");
  const isGlobalRole = instansiId === null && (isSuperAdmin || isDirector);

  return (
    <AuthContext.Provider value={{
      user, employee, roles, loading,
      signIn, signOut, hasRole,
      isAdminOrHr, isSuperAdmin, isHr, isEmployee, isDirector,
      instansiId, isGlobalRole, currentInstitution, allInstitutions,
      selectedInstansiId, setSelectedInstansiId, refreshInstitutions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
