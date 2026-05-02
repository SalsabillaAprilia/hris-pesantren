import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  FileCheck,
  ListTodo,
  BarChart3,
  FileText,
  LogOut,
  CalendarDays,
  ShieldCheck,
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, employee, isAdminOrHr, isSuperAdmin, hasRole } = useAuth();
  const isUnitLeader = hasRole("unit_leader");
  const isEmployee = !isAdminOrHr; // employee biasa atau unit_leader

  // Filter menu berdasarkan role
  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
    { title: "Karyawan", url: "/employees", icon: Users, show: isAdminOrHr || isUnitLeader },
    { title: "Unit", url: "/units", icon: Building2, show: isAdminOrHr },
    { title: "Kehadiran", url: "/attendance", icon: Clock, show: true },
    { title: "Persetujuan", url: "/approvals", icon: FileCheck, show: isAdminOrHr || isUnitLeader },
    { title: "Tugas", url: "/tasks", icon: ListTodo, show: true },
    { title: "Agenda", url: "/agenda", icon: CalendarDays, show: true },
    { title: "KPI", url: "/kpi", icon: BarChart3, show: true },
    { title: "Laporan", url: "/reports", icon: FileText, show: isAdminOrHr || isUnitLeader },
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
                <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">
                  P
                </div>
                <div>
                  <p className="text-sm font-semibold text-sidebar-accent-foreground">Pesantren HRIS</p>
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
      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed && employee && (
          <div className="flex items-center gap-3 mb-4 px-1">
            <Avatar className="h-9 w-9 border-2 border-sidebar-accent shadow-sm">
              <AvatarImage src={employee.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="bg-slate-100 text-primary font-bold text-xs ring-1 ring-white/20">
                {employee.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">{employee.name}</p>
              <p className="text-[10px] text-sidebar-muted truncate">{employee.email}</p>
            </div>
          </div>
        )}
        {collapsed && employee && (
           <div className="flex justify-center mb-4">
             <Avatar className="h-8 w-8 border-2 border-sidebar-accent shadow-sm">
               <AvatarImage src={employee.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="bg-slate-100 text-primary font-bold text-[10px] ring-1 ring-white/20">
                  {employee.name.charAt(0)}
                </AvatarFallback>
             </Avatar>
           </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full px-4 text-sidebar-foreground hover:bg-white/10 hover:text-red-400 transition-colors justify-start group/logout border-t border-sidebar-border/30 rounded-none h-12"
        >
          <LogOut className="h-4 w-4 group-hover/logout:text-red-500 transition-colors" />
          {!collapsed && <span className="ml-2 group-hover/logout:text-red-400 transition-colors">Keluar</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
