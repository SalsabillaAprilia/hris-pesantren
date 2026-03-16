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

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Karyawan", url: "/employees", icon: Users },
  { title: "Unit", url: "/units", icon: Building2 },
  { title: "Kehadiran", url: "/attendance", icon: Clock },
  { title: "Persetujuan", url: "/approvals", icon: FileCheck },
  { title: "Tugas", url: "/tasks", icon: ListTodo },
  { title: "KPI", url: "/kpi", icon: BarChart3 },
  { title: "Laporan", url: "/reports", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, employee } = useAuth();

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
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && employee && (
          <div className="mb-2 px-2">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{employee.name}</p>
            <p className="text-xs text-sidebar-muted truncate">{employee.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={signOut}
          className="w-full text-sidebar-foreground hover:text-destructive hover:bg-sidebar-accent justify-start"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Keluar</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
