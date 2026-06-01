import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/employees";
import Organization from "./pages/Organization";
import Attendance from "./pages/Attendance";
import Approvals from "./pages/Approvals";
import Tasks from "./pages/Tasks";
import Agendas from "./pages/Agendas";
import KPI from "./pages/KPI";
import Reports from "./pages/Reports";
import WorkSchedules from "./pages/WorkSchedules";
import NationalHolidays from "./pages/NationalHolidays";
import AdminAccounts from "./pages/AdminAccounts";
import Branches from "./pages/Branches";
import MyData from "./pages/MyData";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { GlobalModeGuard } from "@/components/shared/GlobalModeGuard";

const queryClient = new QueryClient();

/** Hanya mengizinkan user yang sudah login */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Hanya mengizinkan user yang belum login (halaman publik) */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Guard berbasis role. Jika kondisi `allowed` tidak terpenuhi,
 * redirect ke "/" alih-alih menampilkan 404 atau halaman kosong.
 */
function RoleGuard({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  const { loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Wrapper gabungan: cek login dulu, lalu cek role */
function GuardedRoute({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleGuard allowed={allowed}>
        {children}
      </RoleGuard>
    </ProtectedRoute>
  );
}

/** Komponen pembantu agar bisa menggunakan hook useAuth di dalam Routes */
function AppRoutes() {
  const { isAdminOrHr, isSuperAdmin, isHr, hasRole } = useAuth();
  const isUnitLeader = hasRole("unit_leader");
  const isEmployee = hasRole("employee");
  const isDirector = hasRole("director");
  const isEmployeeOrLeader = isEmployee || isUnitLeader;

  // Alias untuk keterbacaan kode
  const adminOrHr       = isAdminOrHr;                    // super_admin & hr
  const adminHrOrLeader = isAdminOrHr || isUnitLeader;     // super_admin, hr, unit_leader
  const adminHrLeaderOrDirector = adminHrOrLeader || isDirector;
  const attendanceAccess = isAdminOrHr || isUnitLeader || isEmployee; // semua kecuali director
  const allRoles        = true;                            // semua role yang sudah login

  return (
    <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Semua role yang login bisa akses */}
      <Route path="/"          element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/attendance" element={<GuardedRoute allowed={attendanceAccess}><GlobalModeGuard><Attendance /></GlobalModeGuard></GuardedRoute>} />
      <Route path="/tasks"     element={<ProtectedRoute><GlobalModeGuard><Tasks /></GlobalModeGuard></ProtectedRoute>} />
      <Route path="/agenda"    element={<ProtectedRoute><GlobalModeGuard><Agendas /></GlobalModeGuard></ProtectedRoute>} />
      <Route path="/kpi"       element={<ProtectedRoute><GlobalModeGuard><KPI /></GlobalModeGuard></ProtectedRoute>} />

      {/* Admin/HR + Unit Leader (tidak untuk employee biasa) */}
      <Route path="/employees" element={<GuardedRoute allowed={adminHrOrLeader}><GlobalModeGuard><Employees /></GlobalModeGuard></GuardedRoute>} />
      <Route path="/approvals" element={<GuardedRoute allowed={adminHrOrLeader}><GlobalModeGuard><Approvals /></GlobalModeGuard></GuardedRoute>} />
      <Route path="/reports"   element={<GuardedRoute allowed={adminHrLeaderOrDirector}><Reports /></GuardedRoute>} />

      {/* Khusus Admin/HR saja */}
      <Route path="/organization"   element={<GuardedRoute allowed={adminOrHr}><GlobalModeGuard><Organization /></GlobalModeGuard></GuardedRoute>} />
      <Route path="/work-schedules" element={<GuardedRoute allowed={adminOrHr}><GlobalModeGuard><WorkSchedules /></GlobalModeGuard></GuardedRoute>} />
      <Route path="/holidays"       element={<GuardedRoute allowed={adminOrHr}><GlobalModeGuard><NationalHolidays /></GlobalModeGuard></GuardedRoute>} />

      {/* Khusus Super Admin */}
      <Route path="/admin-accounts" element={<GuardedRoute allowed={isSuperAdmin}><AdminAccounts /></GuardedRoute>} />
      <Route path="/branches"       element={<GuardedRoute allowed={isSuperAdmin}><Branches /></GuardedRoute>} />

      {/* Khusus Employee & Unit Leader: data diri */}
      <Route path="/my-data" element={<GuardedRoute allowed={isEmployeeOrLeader}><MyData /></GuardedRoute>} />

      {/* Halaman tidak ditemukan */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

