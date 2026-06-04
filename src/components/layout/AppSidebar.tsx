import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  FileCheck,
  ListTodo,
  BarChart3,
  FileText,
  CalendarDays,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdminOrHr, isSuperAdmin, hasRole, isDirector, currentInstitution, isGlobalRole, selectedInstansiId } = useAuth();
  const isUnitLeader = hasRole("unit_leader");
  const isEmployee = !isAdminOrHr; // employee biasa atau unit_leader

  // Global mode = akun super_admin/director yang belum pilih cabang
  const isGlobalMode = isGlobalRole && !selectedInstansiId;

  const instName = currentInstitution?.name ?? "Pesantren HRIS";
  const instInitial = instName.charAt(0).toUpperCase();

  // Filter menu berdasarkan role
  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
    // Modul operasional — disembunyikan di global mode agar tidak bisa input data tanpa cabang
    { title: "Karyawan", url: "/employees", icon: Users, show: !isGlobalMode && (isAdminOrHr || isUnitLeader || isDirector) },
    { title: "Organisasi", url: "/organization", icon: Building2, show: !isGlobalMode && (isAdminOrHr || isDirector) },
    { title: "Kehadiran", url: "/attendance", icon: Clock, show: !isGlobalMode && !isDirector },
    { title: "Approval", url: "/approvals", icon: FileCheck, show: !isGlobalMode && (isAdminOrHr || isUnitLeader) },
    { title: "Tugas", url: "/tasks", icon: ListTodo, show: !isGlobalMode && !isDirector },
    { title: "Agenda", url: "/agenda", icon: CalendarDays, show: !isGlobalMode && !isDirector },
    { title: "KPI", url: "/kpi", icon: BarChart3, show: !isGlobalMode },
    // Modul monitoring — tetap tampil di global mode
    { title: "Laporan", url: "/reports", icon: FileText, show: isAdminOrHr || isUnitLeader || isDirector },
    // Menu khusus Super Admin
    { title: "Manajemen Akun", url: "/admin-accounts", icon: ShieldCheck, show: isSuperAdmin },
  ].filter(item => item.show);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={`pt-6 pb-2 transition-all ${collapsed ? 'px-2' : 'px-4'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-3'}`}>
          <div className={`rounded-lg flex items-center justify-center font-bold shrink-0 overflow-hidden transition-all ${collapsed ? 'h-8 w-8 text-lg' : 'h-11 w-11 text-2xl'} ${currentInstitution?.logo_url ? 'bg-transparent' : 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'}`}>
            {currentInstitution?.logo_url ? (
              <img src={currentInstitution.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              instInitial
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-[1.3] font-bold text-sidebar-foreground line-clamp-2" title={instName}>
                {instName}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="mt-2">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
