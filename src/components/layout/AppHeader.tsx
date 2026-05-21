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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Maximize, Minimize, LogOut, User, CheckCheck, FileCheck, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { QuickAttendanceDialog } from "../attendance/QuickAttendanceDialog";

interface NotifItem {
  id: string;
  type: "approval" | "task";
  message: string;
  created_at: string;
  read: boolean;
}

export function AppHeader() {
  const { employee, isEmployee, isAdminOrHr, isDirector, signOut } = useAuth();
  const navigate = useNavigate();

  // ── Fullscreen ──────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // ── Notifikasi ───────────────────────────────────────────
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const fetchNotifs = useCallback(async () => {
    if (!employee) return;
    try {
      const items: NotifItem[] = [];

      if (isAdminOrHr) {
        // HR/Admin: approval yang masih pending
        const res = await supabaseFetchWithTimeout(
          supabase
            .from("approvals")
            .select("id, type, created_at, employees(name)")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(10),
          15000
        );
        (res?.data || []).forEach((a: any) => {
          const typeLabel: Record<string, string> = {
            leave: "cuti", permission: "izin", overtime: "lembur",
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

      if (isEmployee) {
        // Karyawan: tugas yang baru diassign (status todo)
        const res = await supabaseFetchWithTimeout(
          supabase
            .from("tasks")
            .select("id, title, created_at")
            .eq("assigned_to", employee.id)
            .eq("status", "todo")
            .order("created_at", { ascending: false })
            .limit(8),
          15000
        );
        (res?.data || []).forEach((t: any) => {
          items.push({
            id: t.id,
            type: "task",
            message: `Tugas baru: "${t.title}"`,
            created_at: t.created_at,
            read: false,
          });
        });
      }

      // Mark items that have been read before
      const marked = items.map((n) => ({ ...n, read: readIds.has(n.id) }));
      marked.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifs(marked);
    } catch (err) {
      console.error("AppHeader: notif fetch failed", err);
    }
  }, [employee, isAdminOrHr, isEmployee, readIds]);

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
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotifClick = (notif: NotifItem) => {
    setReadIds((prev) => new Set([...prev, notif.id]));
    setNotifsOpen(false);
    if (notif.type === "approval") navigate("/approvals");
    else navigate("/tasks");
  };

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0 gap-2">
      {/* Kiri: Sidebar toggle */}
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      {/* Kanan: Action items */}
      <div className="flex items-center gap-1">
        {/* Presensi cepat (hanya employee & unit_leader) */}
        {isEmployee && <QuickAttendanceDialog />}

        {/* Fullscreen toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
        >
          {isFullscreen
            ? <Minimize className="h-4 w-4" />
            : <Maximize className="h-4 w-4" />}
        </Button>

        {/* Notifikasi */}
        <DropdownMenu open={notifsOpen} onOpenChange={(o) => { setNotifsOpen(o); if (o) fetchNotifs(); }}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none">
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
                        : <CheckCheck className="h-3.5 w-3.5" />}
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
            <Button variant="ghost" className="h-8 pl-1 pr-2 gap-2 hover:bg-muted/60">
              <Avatar className="h-6 w-6 border border-border">
                <AvatarImage src={employee?.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                  {employee?.name?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-foreground max-w-[100px] truncate hidden sm:inline">
                {employee?.name?.split(" ")[0] ?? "Pengguna"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 shadow-xl">
            <DropdownMenuLabel className="py-2">
              <p className="text-sm font-semibold truncate">{employee?.name ?? "Pengguna"}</p>
              <p className="text-[11px] text-muted-foreground font-normal truncate">{employee?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => navigate("/profile")}
            >
              <User className="h-4 w-4" />
              Profil Akun
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
