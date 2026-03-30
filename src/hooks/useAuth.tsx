import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type AppRole = "super_admin" | "hr" | "unit_leader" | "employee";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Tables<"employees"> | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const [empRes, rolesRes] = await Promise.all([
        supabase.from("employees").select("*").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      
      if (empRes.error && empRes.error.code !== "PGRST116") {
        console.error("Error fetching employee:", empRes.error);
      }
      if (rolesRes.error) {
        console.error("Error fetching roles:", rolesRes.error);
      }

      if (empRes.data) setEmployee(empRes.data);
      if (rolesRes.data) setRoles(rolesRes.data.map((r) => r.role as AppRole));
    } catch (err) {
      console.error("Unexpected error in fetchUserData:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Fail-safe: jika Supabase terlalu lambat (misal project paused), paksa loading selesai
    const fallback = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 15000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await fetchUserData(u.id);
        } else {
          setEmployee(null);
          setRoles([]);
        }
        if (mounted) { setLoading(false); clearTimeout(fallback); }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await fetchUserData(u.id);
      }
      if (mounted) { setLoading(false); clearTimeout(fallback); }
    });

    return () => {
      mounted = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

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
      setUser(null);
      setEmployee(null);
      setRoles([]);
      window.location.href = "/login";
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isSuperAdmin = hasRole("super_admin");
  const isAdminOrHr = isSuperAdmin || hasRole("hr");

  return (
    <AuthContext.Provider value={{ user, employee, roles, loading, signIn, signOut, hasRole, isAdminOrHr, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
