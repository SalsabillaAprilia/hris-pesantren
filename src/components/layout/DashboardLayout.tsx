import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { QuickAttendanceDialog } from "../attendance/QuickAttendanceDialog";
import { useAuth } from "@/hooks/useAuth";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { isEmployee } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
            </div>
            {/* Tombol presensi cepat hanya untuk karyawan (employee & unit_leader) */}
            {isEmployee && <QuickAttendanceDialog />}
          </header>
          <main className="flex-1 p-6 overflow-auto animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
