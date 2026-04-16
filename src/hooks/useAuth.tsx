import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
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

  const [lastRefresh, setLastRefresh] = useState<number>(0);

  const refreshSession = async (force: boolean = false) => {
    const now = Date.now();
    
    // Performance Optimization: Skip full refresh if it was done recently (< 5 minutes)
    // and we already have the user and employee data.
    if (!force && lastRefresh > 0 && (now - lastRefresh < 300000) && user && employee) {
      console.log("Auth: Session is fresh, skipping metadata fetch.");
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabaseFetchWithTimeout(supabase.auth.getSession(), 20000);
      const u = session?.user ?? null;
      
      if (u) {
        // Only fetch profile metadata if missing, forced, or specifically user changed
        if (!employee || !roles.length || force || u.id !== user?.id) {
          console.log("Auth: Fetching profile metadata...");
          const [empRes, rolesRes] = await Promise.all([
            supabaseFetchWithTimeout(supabase.from("employees").select("*").eq("user_id", u.id).single(), 20000),
            supabaseFetchWithTimeout(supabase.from("user_roles").select("role").eq("user_id", u.id), 20000),
          ]);
          
          if (empRes?.data) setEmployee(empRes.data);
          if (rolesRes?.data) setRoles(rolesRes.data.map((r) => r.role as AppRole) || []);
        }
        
        setUser(u);
        setLastRefresh(now);
      } else {
        setUser(null);
        setEmployee(null);
        setRoles([]);
      }
    } catch (err) {
      console.error("Auth: Session refresh failed:", err);
      if (!user) setUser(null); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let visibilityTimeout: NodeJS.Timeout;

    // Initial session check (forced)
    refreshSession(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log("Auth Event:", event);
        
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setEmployee(null);
          setRoles([]);
          setLoading(false);
          setLastRefresh(0);
          return;
        }

        const u = session.user;
        try {
          // Optimization: If it's just a token refresh and we already have data, don't block
          if (event === 'TOKEN_REFRESHED' && employee && u.id === user?.id) {
            setUser(u);
            return;
          }

          const [empRes, rolesRes] = await Promise.all([
            supabaseFetchWithTimeout(supabase.from("employees").select("*").eq("user_id", u.id).single(), 20000),
            supabaseFetchWithTimeout(supabase.from("user_roles").select("role").eq("user_id", u.id), 20000),
          ]);
          
          if (empRes?.data) setEmployee(empRes.data);
          if (rolesRes?.data) setRoles(rolesRes.data.map((r) => r.role as AppRole) || []);
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
        // Small debounce to prevent rapid re-triggering and give browser time to wake up
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
