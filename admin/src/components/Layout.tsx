import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { logout as apiLogout } from "../api/admin";
import { ROLE_TITLES } from "../lib/types";
import {
  LayoutDashboard, Home, Receipt, TicketCheck, Store,
  ShieldCheck, ScrollText, LogOut, Heart, Settings, Megaphone,
  Users, BarChart3, MapPin, Zap, Package,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, minRole: 1 },
  { to: "/households", label: "Households", icon: Home, minRole: 2 },
  { to: "/members", label: "Members", icon: Users, minRole: 2 },
  { to: "/allocations", label: "Allocations", icon: BarChart3, minRole: 1 },
  { to: "/redemptions", label: "Redemptions", icon: Receipt, minRole: 1 },
  { to: "/centers", label: "Centers", icon: MapPin, minRole: 2 },
  { to: "/powerbanks", label: "Power Banks", icon: Zap, minRole: 3 },
  { to: "/catalog", label: "Catalog", icon: Package, minRole: 1 },
  { to: "/tickets", label: "Tickets", icon: TicketCheck, minRole: 2 },
  { to: "/providers", label: "Providers", icon: Store, minRole: 3 },
  { to: "/volunteers", label: "Volunteers", icon: Heart, minRole: 4 },
  { to: "/notices", label: "Notices", icon: Megaphone, minRole: 5 },
  { to: "/users", label: "Admin Users", icon: ShieldCheck, minRole: 6 },
  { to: "/audit", label: "Audit Trail", icon: ScrollText, minRole: 1 },
  { to: "/settings", label: "Settings", icon: Settings, minRole: 1 },
];

export function Layout({ children }: { children: ReactNode }) {
  const { admin, logout: localLogout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await apiLogout(); } catch { /* ok */ }
    localLogout();
    navigate("/login");
  };

  const roleLevel = admin?.role_level ?? 1;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 start-0 flex flex-col border-e border-[var(--border)] bg-[var(--bg)]"
        style={{ width: "var(--sidebar-w)" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-[var(--border)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-bold text-sm">V</div>
          <div>
            <div className="text-sm font-bold" style={{ color: "var(--text-1)" }}>ViWo Admin</div>
            <div className="text-[10px]" style={{ color: "var(--text-3)" }}>Crisis Management</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV.filter((n) => roleLevel >= n.minRole).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors mb-0.5 ${
                  isActive
                    ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/[0.03]"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-bold" style={{ color: "var(--accent)" }}>
              {admin?.full_name?.charAt(0) ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-semibold" style={{ color: "var(--text-1)" }}>
                {admin?.full_name ?? "Admin"}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
                {ROLE_TITLES[admin?.role_level ?? 1]}
              </div>
            </div>
            <button onClick={handleLogout} className="text-[var(--text-3)] hover:text-[var(--danger)] transition-colors" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1" style={{ marginInlineStart: "var(--sidebar-w)" }}>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
