import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { Layout } from "../components/Layout";
import { CommandPalette } from "../components/CommandPalette";
import { Toaster } from "../components/Toast";
import { DialogHost } from "../components/Dialog";
import { KycReviewPage } from "../pages/KycReviewPage";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { HouseholdsPage } from "../pages/HouseholdsPage";
import { RedemptionsPage } from "../pages/RedemptionsPage";
import { TicketsPage } from "../pages/TicketsPage";
import { ProvidersPage } from "../pages/ProvidersPage";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { AuditPage } from "../pages/AuditPage";
import { VolunteersPage } from "../pages/VolunteersPage";
import { SettingsPage } from "../pages/SettingsPage";
import { NoticesPage } from "../pages/NoticesPage";
import { MembersPage } from "../pages/MembersPage";
import { AllocationsPage } from "../pages/AllocationsPage";
import { CatalogPage } from "../pages/CatalogPage";
import { PowerBanksPage } from "../pages/PowerBanksPage";
import { CentersPage } from "../pages/CentersPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated());
  if (!isAuth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <CommandPalette />
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/households" element={<HouseholdsPage />} />
                  <Route path="/members" element={<MembersPage />} />
                  <Route path="/kyc" element={<KycReviewPage />} />
                  <Route path="/allocations" element={<AllocationsPage />} />
                  <Route path="/centers" element={<CentersPage />} />
                  <Route path="/catalog" element={<CatalogPage />} />
                  <Route path="/powerbanks" element={<PowerBanksPage />} />
                  <Route path="/redemptions" element={<RedemptionsPage />} />
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route path="/providers" element={<ProvidersPage />} />
                  <Route path="/volunteers" element={<VolunteersPage />} />
                  <Route path="/users" element={<AdminUsersPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/notices" element={<NoticesPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      {/* Global toaster + dialog host — mounted once outside routes so they
          survive navigation. */}
      <Toaster />
      <DialogHost />
    </>
  );
}
