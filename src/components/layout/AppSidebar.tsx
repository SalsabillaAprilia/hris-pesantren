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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdminOrHr, isSuperAdmin, hasRole, isDirector, currentInstitution } = useAuth();
  const isUnitLeader = hasRole("unit_leader");
  const isEmployee = !isAdminOrHr; // employee biasa atau unit_leader

  const instName = currentInstitution?.name ?? "Pesantren HRIS";
  const instInitial = instName.charAt(0).toUpperCase();

  // Filter menu berdasarkan role
  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
    { title: "Karyawan", url: "/employees", icon: Users, show: isAdminOrHr || isUnitLeader },
    { title: "Organisasi", url: "/organization", icon: Building2, show: isAdminOrHr },
    { title: "Kehadiran", url: "/attendance", icon: Clock, show: !isDirector },
    { title: "Persetujuan", url: "/approvals", icon: FileCheck, show: isAdminOrHr || isUnitLeader },
    { title: "Tugas", url: "/tasks", icon: ListTodo, show: !isDirector },
    { title: "Agenda", url: "/agenda", icon: CalendarDays, show: !isDirector },
    { title: "KPI", url: "/kpi", icon: BarChart3, show: !isDirector },
    { title: "Laporan", url: "/reports", icon: FileText, show: isAdminOrHr || isUnitLeader || isDirector },
    // Menu khusus Super Admin
    { title: "Manajemen Akun", url: "/admin-accounts", icon: ShieldCheck, show: isSuperAdmin },
  ].filter(item => item.show);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider mb-2">
            {!collapsed && (
              <div className="flex items-center gap-2 px-2 py-3">
                <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0 overflow-hidden">
                  {currentInstitution?.logo_url ? (
                    <img src={currentInstitution.logo_url} alt="Logo" className="w-full h-full object-cover bg-white" />
                  ) : (
                    instInitial
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sidebar-accent-foreground truncate" title={instName}>{instName}</p>
                </div>
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
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
