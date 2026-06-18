import { useEffect, useState, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, BellRing, Maximize, Minimize, LogOut, User, UserCog, CheckCheck, FileCheck, FileText, Building2, ChevronDown, Plus, Globe, Settings, ListTodo } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { supabase } from "@/integrations/supabase/client";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { QuickAttendanceDialog } from "../attendance/QuickAttendanceDialog";
import React from "react";

type BreadcrumbSegment = { name: string; path?: string };

const BREADCRUMB_MAP: Record<string, BreadcrumbSegment[]> = {
  "/": [{ name: "Dashboard" }],
  "/dashboard": [{ name: "Dashboard" }],
  "/employees": [{ name: "Karyawan" }],
  "/organization": [{ name: "Organisasi" }],
  "/work-schedules": [{ name: "Kehadiran", path: "/attendance" }, { name: "Jadwal Kerja" }],
  "/holidays": [{ name: "Organisasi", path: "/organization" }, { name: "Libur Nasional" }],
  "/attendance": [{ name: "Kehadiran" }],
  "/approvals": [{ name: "Approval" }],
  "/tasks": [{ name: "Tugas" }],
  "/agenda": [{ name: "Agenda" }],
  "/kpi": [{ name: "KPI" }],
  "/reports": [{ name: "Laporan" }],
  "/my-data": [{ name: "Data Diri" }],
  "/branches": [{ name: "Pengaturan Cabang" }],
  "/admin-accounts": [{ name: "Manajemen Akun" }],
  "/profile": [{ name: "Profil" }]
};

interface NotifItem {
  id: string;
  type: "approval" | "task";
  message: string;
  created_at: string;
  read: boolean;
}

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
};

export function AppHeader() {
  const { employee, isEmployee, hasRole, isAdminOrHr, isDirector, signOut, isGlobalRole, allInstitutions, selectedInstansiId, setSelectedInstansiId } = useAuth();
  const { effectiveInstansiId } = useInstansiFilter();
  const isUnitLeader = hasRole("unit_leader");
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbs = BREADCRUMB_MAP[location.pathname] || [{ name: "Sistem" }];

  // ── Notifikasi ───────────────────────────────────────────
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("amanahr_read_notifs");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const fetchNotifs = useCallback(async () => {
    try {
      const items: NotifItem[] = [];

      // 1. Approvals: pending (HANYA untuk HR dan Unit Leader)
      if (hasRole("hr") || isUnitLeader) {
        let q = supabase
          .from("approvals")
          .select("id, type, created_at, employee_id, employees!inner(name, unit_id, user_id)")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(100);
          
        if (effectiveInstansiId) {
          q = q.eq("instansi_id", effectiveInstansiId);
        }

        const res = await supabaseFetchWithTimeout(q, 15000);
        let approvalsData = res?.data || [];
        
        if (approvalsData.length > 0) {
          const userIds = [...new Set(approvalsData.map((a: any) => a.employees?.user_id).filter(Boolean))];
          if (userIds.length > 0) {
            const { data: rolesData } = await supabaseFetchWithTimeout(
              supabase.from("user_roles").select("user_id, role").in("user_id", userIds as string[])
            );
            const rolesMap = new Map();
            (rolesData ?? []).forEach((r: any) => {
              if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
              rolesMap.get(r.user_id).push(r.role);
            });
            
            const isHr = hasRole("hr");

            approvalsData = approvalsData.filter((a: any) => {
              const roles = rolesMap.get(a.employees?.user_id) || ["employee"];
              const submitterRole = roles.includes("unit_leader") ? "unit_leader" : (roles.includes("employee") ? "employee" : roles[0]);
              const isFromMyUnit = a.employees?.unit_id === employee?.unit_id;
              
              const canSeeAsLeader = isUnitLeader && isFromMyUnit && submitterRole !== "unit_leader" && a.employee_id !== employee?.id;
              const canSeeAsHr = isHr && submitterRole === "unit_leader" && a.employee_id !== employee?.id;
              
              return canSeeAsLeader || canSeeAsHr;
            });
          }
        }

        approvalsData.slice(0, 10).forEach((a: any) => {
          const typeLabel: Record<string, string> = {
            leave: "cuti", permission: "izin", overtime: "lembur", sick: "sakit", wfa: "WFA/WFH"
          };
          items.push({
            id: a.id,
            type: "approval",
            message: `${a.employees?.name ?? "Karyawan"} mengajukan ${typeLabel[a.type] ?? a.type}`,
            created_at: a.created_at,
            read: false,
          });
        });
      }

      // 1b. Approvals: Personal Ditolak/Disetujui (Untuk Karyawan & Unit Leader)
      if (isEmployee && employee?.id) {
        const res = await supabaseFetchWithTimeout(
          supabase
            .from("approvals")
            .select("id, type, status, updated_at")
            .eq("employee_id", employee.id)
            .in("status", ["approved_hr", "approved_unit_leader", "rejected"])
            .order("updated_at", { ascending: false })
            .limit(10),
          15000
        );
        (res?.data || []).forEach((a: any) => {
          const typeLabel: Record<string, string> = {
            leave: "cuti", permission: "izin", overtime: "lembur", sick: "sakit", wfa: "WFA/WFH"
          };
          const statusText = a.status === "rejected" ? "ditolak" : "disetujui";
          items.push({
            id: `personal-app-${a.id}-${a.status}`,
            type: "approval",
            message: `Pengajuan ${typeLabel[a.type] ?? a.type} Anda ${statusText}`,
            created_at: a.updated_at || new Date().toISOString(),
            read: false,
          });
        });
      }

      // 2a. Agenda: SUBMITTED (HANYA untuk Unit Leader)
      if (isUnitLeader && employee?.unit_id) {
        let q = supabase
          .from("agenda_reports")
          .select("id, start_date, updated_at, employee_id, employees!inner(name, unit_id)")
          .eq("status", "SUBMITTED")
          .eq("employees.unit_id", employee.unit_id)
          .neq("employee_id", employee.id)
          .order("updated_at", { ascending: false })
          .limit(10);
          
        if (effectiveInstansiId) {
          q = q.eq("instansi_id", effectiveInstansiId);
        }
        
        const res = await supabaseFetchWithTimeout(q, 15000);
        (res?.data || []).forEach((a: any) => {
          items.push({
            id: `agenda-${a.id}`,
            type: "task",
            message: `Laporan Agenda menunggu persetujuan: ${a.employees?.name}`,
            created_at: a.updated_at || new Date().toISOString(),
            read: false,
          });
        });
      }

      // 2b. Agenda: Personal Status Berubah (Untuk Karyawan)
      if (isEmployee && employee?.id) {
        const res = await supabaseFetchWithTimeout(
          supabase
            .from("agenda_reports")
            .select("id, status, updated_at")
            .eq("employee_id", employee.id)
            .in("status", ["APPROVED", "REVISION_REQUESTED"])
            .order("updated_at", { ascending: false })
            .limit(10),
          15000
        );
        (res?.data || []).forEach((a: any) => {
          const statusMap: Record<string, string> = {
             "APPROVED": "disetujui",
             "REJECTED": "ditolak",
             "REVISION_REQUESTED": "direvisi"
          };
          items.push({
            id: `personal-agenda-${a.id}-${a.status}`,
            type: "task",
            message: `Laporan Agenda Anda telah ${statusMap[a.status] || a.status}`,
            created_at: a.updated_at || new Date().toISOString(),
            read: false,
          });
        });
      }

      // 3a. Tasks: pending_review (HANYA untuk Unit Leader)
      if (isUnitLeader && employee?.unit_id) {
        let q = supabase
          .from("tasks")
          .select("id, title, created_at, employees!inner(unit_id)")
          .eq("status", "pending_review" as any)
          .eq("employees.unit_id", employee.unit_id)
          .order("created_at", { ascending: false })
          .limit(10);
          
        if (effectiveInstansiId) {
          q = q.eq("instansi_id", effectiveInstansiId);
        }
        
        const res = await supabaseFetchWithTimeout(q, 15000);
        (res?.data || []).forEach((t: any) => {
          items.push({
            id: t.id,
            type: "task",
            message: `Tugas menunggu konfirmasi: "${t.title}"`,
            created_at: t.created_at,
            read: false,
          });
        });
      }

      // 3b. Employee Tasks: todo, revised, completed (HANYA untuk Karyawan)
      if (isEmployee && employee?.id) {
        const resTodo = await supabaseFetchWithTimeout(
          supabase
            .from("tasks")
            .select("id, title, created_at")
            .eq("assigned_to", employee.id)
            .eq("status", "todo")
            .order("created_at", { ascending: false })
            .limit(8),
          15000
        );
        (resTodo?.data || []).forEach((t: any) => {
          items.push({
            id: t.id,
            type: "task",
            message: `Tugas baru: "${t.title}"`,
            created_at: t.created_at,
            read: false,
          });
        });

        const resStatus = await supabaseFetchWithTimeout(
          supabase
            .from("tasks")
            .select("id, title, updated_at, status")
            .eq("assigned_to", employee.id)
            .in("status", ["revision", "done"] as any[])
            .order("updated_at", { ascending: false })
            .limit(8),
          15000
        );
        (resStatus?.data || []).forEach((t: any) => {
          const statusText = t.status === "revision" ? "dikembalikan untuk direvisi" : "disetujui (selesai)";
          items.push({
            id: `task-status-${t.id}-${t.status}`,
            type: "task",
            message: `Tugas "${t.title}" telah ${statusText}`,
            created_at: t.updated_at || new Date().toISOString(),
            read: false,
          });
        });
      }

      // Tandai yang sudah dibaca, urutkan berdasarkan waktu, dan limit 20 agar rapi
      const marked = items.map((n) => ({ ...n, read: readIds.has(n.id) }));
      marked.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifs(marked.slice(0, 20));
      
      // Pancarkan sinyal global agar halaman aktif ikut me-refresh datanya bersamaan dengan notifikasi
      window.dispatchEvent(new Event('app_data_updated'));
    } catch (err) {
      console.error("AppHeader: notif fetch failed", err);
    }
  }, [employee, isAdminOrHr, isDirector, isEmployee, isUnitLeader, readIds, effectiveInstansiId]);

  useEffect(() => {
    fetchNotifs();
    // Poll setiap 2 menit
    const interval = setInterval(fetchNotifs, 120000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const unreadCount = notifs.filter((n) => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set(notifs.map((n) => n.id));
    setReadIds(allIds);
    localStorage.setItem("amanahr_read_notifs", JSON.stringify(Array.from(allIds)));
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotifClick = (notif: NotifItem) => {
    setReadIds((prev) => {
      const newSet = new Set([...prev, notif.id]);
      localStorage.setItem("amanahr_read_notifs", JSON.stringify(Array.from(newSet)));
      return newSet;
    });
    setNotifsOpen(false);
    
    if (notif.id.includes("agenda")) {
      navigate("/agenda");
    } else if (notif.id.startsWith("personal-app-")) {
      navigate("/attendance", { state: { tab: "pengajuan" } });
    } else if (notif.type === "approval") {
      navigate("/approvals");
    } else {
      navigate("/tasks");
    }
  };

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0 gap-2">
      {/* Kiri: Sidebar toggle + Breadcrumbs */}
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-9 w-9 text-slate-500 shrink-0" />
        <div className="hidden sm:flex items-center text-xs font-medium text-slate-500">
          <Link to="/" className="hover:text-slate-900 transition-colors">Beranda</Link> 
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={idx}>
              <span className="mx-2 text-slate-300">/</span>
              {bc.path ? (
                <Link to={bc.path} className="hover:text-slate-900 transition-colors">
                  {bc.name}
                </Link>
              ) : (
                <span className="text-slate-800 font-bold">{bc.name}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Kanan: Action items */}
      <div className="flex items-center gap-2">
        {isGlobalRole && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-3 flex items-center gap-2 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors group">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 hidden sm:inline group-hover:text-slate-900">
                  {selectedInstansiId ? allInstitutions.find(i => i.id === selectedInstansiId)?.name : "SEMUA CABANG"}
                </span>
                <Building2 className="h-4 w-4 text-slate-700 sm:hidden group-hover:text-slate-900" />
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-slate-900" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[260px] shadow-xl border-slate-100">
              <DropdownMenuItem 
                onClick={() => setSelectedInstansiId(null)}
                className="gap-2 cursor-pointer"
              >
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">Semua Cabang</span>
                {selectedInstansiId === null && <CheckCheck className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
              
              {allInstitutions.map(inst => (
                <DropdownMenuItem 
                  key={inst.id}
                  onClick={() => setSelectedInstansiId(inst.id)}
                  className="gap-2 cursor-pointer"
                >
                  {inst.logo_url ? (
                    <img src={inst.logo_url} alt="Logo" className="w-4 h-4 rounded object-contain shrink-0" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate flex-1">{toTitleCase(inst.name)}</span>
                  {selectedInstansiId === inst.id && <CheckCheck className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => navigate("/branches")}
                className="gap-2 cursor-pointer"
              >
                <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Kelola Cabang</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Presensi cepat (hanya employee) */}
        {isEmployee && <QuickAttendanceDialog />}
        <DropdownMenu open={notifsOpen} onOpenChange={(o) => { setNotifsOpen(o); if (o) fetchNotifs(); }}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-slate-200 bg-white shadow-sm text-slate-700 transition-colors relative group"
            >
              <BellRing className="h-[18px] w-[18px] text-slate-500 group-hover:text-slate-900 transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-[14px] min-w-[14px] flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none border-[1.5px] border-white px-0.5">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[320px] p-0 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-bold">Notifikasi</p>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-primary"
                  onClick={markAllRead}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tandai semua dibaca
                </Button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Bell className="h-8 w-8 opacity-30" />
                  <p className="text-xs">Tidak ada notifikasi</p>
                </div>
              ) : (
                notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors border-b last:border-0 ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${n.type === "approval" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                      {n.type === "approval"
                        ? <FileCheck className="h-3.5 w-3.5" />
                        : <ListTodo className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!n.read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: localeId })}
                      </p>
                    </div>
                    {!n.read && (
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full ml-1 border border-slate-200 bg-white shadow-sm text-slate-700 relative p-0 overflow-hidden transition-colors group">
              <Avatar className="h-full w-full">
                <AvatarImage src={employee?.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="bg-transparent text-slate-500 flex items-center justify-center group-hover:text-slate-900 transition-colors">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 shadow-xl border-slate-100">
            <DropdownMenuLabel className="py-2 flex flex-col items-center text-center">
              <p className="text-sm font-semibold truncate w-full">{employee?.name ?? "Pengguna"}</p>
              <p className="text-[11px] text-muted-foreground font-normal truncate w-full">{employee?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => navigate("/profile")}
            >
              <UserCog className="h-4 w-4" />
              Ubah Profil
            </DropdownMenuItem>
            {isEmployee && (
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => navigate("/my-data")}
              >
                <FileText className="h-4 w-4" />
                Data Diri
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
