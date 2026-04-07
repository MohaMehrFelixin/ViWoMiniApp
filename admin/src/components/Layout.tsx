import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/useAuthStore";
import { logout as apiLogout } from "../api/admin";
import { ROLE_TITLES } from "../lib/types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  LayoutDashboard, Home, Receipt, TicketCheck, Store,
  ShieldCheck, ScrollText, LogOut, Heart, Settings, Megaphone,
  Users, BarChart3, MapPin, Zap, Package, UserCheck, Menu, X,
  MoreHorizontal,
} from "lucide-react";

// =============================================================================
// NAVIGATION DATA
// =============================================================================
//
// One canonical source of nav items. Each item has:
//   - to: route
//   - i18nKey: translation key
//   - icon: lucide component
//   - minRole: lowest role allowed to see it
//   - bottomNav: shown on the mobile bottom bar (max 4 + "More")
//
// The mobile bottom nav is intentionally limited to 4 destinations + a
// "More" entry that opens the full drawer. This is the iOS HIG / Material 3
// rule of thumb — too many tabs makes them small and unreadable.

interface NavItem {
  to: string;
  i18nKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  minRole: number;
  bottomNav?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", i18nKey: "nav.dashboard", icon: LayoutDashboard, minRole: 1, bottomNav: true },
  { to: "/households", i18nKey: "nav.households", icon: Home, minRole: 2, bottomNav: true },
  { to: "/redemptions", i18nKey: "nav.redemptions", icon: Receipt, minRole: 1, bottomNav: true },
  { to: "/tickets", i18nKey: "nav.tickets", icon: TicketCheck, minRole: 2, bottomNav: true },
  { to: "/members", i18nKey: "nav.members", icon: Users, minRole: 2 },
  { to: "/kyc", i18nKey: "nav.kycReview", icon: UserCheck, minRole: 4 },
  { to: "/allocations", i18nKey: "nav.allocations", icon: BarChart3, minRole: 1 },
  { to: "/centers", i18nKey: "nav.centers", icon: MapPin, minRole: 2 },
  { to: "/powerbanks", i18nKey: "nav.powerBanks", icon: Zap, minRole: 3 },
  { to: "/catalog", i18nKey: "nav.catalog", icon: Package, minRole: 1 },
  { to: "/providers", i18nKey: "nav.providers", icon: Store, minRole: 3 },
  { to: "/volunteers", i18nKey: "nav.volunteers", icon: Heart, minRole: 4 },
  { to: "/notices", i18nKey: "nav.notices", icon: Megaphone, minRole: 5 },
  { to: "/users", i18nKey: "nav.users", icon: ShieldCheck, minRole: 6 },
  { to: "/audit", i18nKey: "nav.audit", icon: ScrollText, minRole: 1 },
  { to: "/settings", i18nKey: "nav.settings", icon: Settings, minRole: 1 },
];

// =============================================================================
// LAYOUT
// =============================================================================

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { admin, logout: localLogout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Drawer state — only relevant on mobile. Closed by default.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close the drawer when the user navigates. This is the standard
  // mobile pattern: tap a nav item → it closes itself.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open so the page underneath
  // doesn't scroll behind it.
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Close drawer on Escape — keyboard a11y.
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // Server-side destroy failed; local logout still proceeds.
    }
    localLogout();
    navigate("/login");
  };

  const roleLevel = admin?.role_level ?? 1;
  const visibleNav = NAV.filter((n) => roleLevel >= n.minRole);
  const bottomNav = visibleNav.filter((n) => n.bottomNav).slice(0, 4);

  // Find the current page title for the mobile top bar.
  const currentPage = visibleNav.find(
    (n) => n.to === location.pathname || (n.to !== "/" && location.pathname.startsWith(n.to))
  );
  const pageTitle = currentPage ? t(currentPage.i18nKey) : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* ─────────────────────────────────────────────────────────────────
          DESKTOP SIDEBAR (lg and up)
          Hidden on mobile. Identical to the previous version.
          ───────────────────────────────────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 start-0 hidden lg:flex flex-col border-e border-[var(--border)] bg-[var(--bg)] z-30"
        style={{ width: "var(--sidebar-w)" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-[var(--border)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-bold text-sm">
            V
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: "var(--text-1)" }}>
              {t("auth.title")}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
              {t("auth.subtitle")}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {visibleNav.map((item) => (
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
              {t(item.i18nKey)}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-2">
          <LanguageSwitcher />
        </div>

        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-bold"
              style={{ color: "var(--accent)" }}
            >
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
            <button
              onClick={handleLogout}
              className="btn-icon"
              title={t("nav.logout")}
              aria-label={t("nav.logout")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────────
          MOBILE TOP APP BAR (below lg)
          Sticky to top. Contains hamburger, page title, language switcher.
          ───────────────────────────────────────────────────────────────── */}
      <header className="mobile-topbar lg:hidden">
        <button
          type="button"
          className="btn-icon"
          onClick={() => setDrawerOpen(true)}
          aria-label={t("nav.dashboard")}
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-white font-bold text-xs flex-shrink-0">
            V
          </div>
          <h1
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-1)" }}
          >
            {pageTitle || t("auth.title")}
          </h1>
        </div>
        <LanguageSwitcher />
      </header>

      {/* ─────────────────────────────────────────────────────────────────
          MOBILE DRAWER (full nav menu)
          Slides in from the leading edge. Backdrop tap closes.
          ───────────────────────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        {/* Backdrop */}
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            opacity: drawerOpen ? 1 : 0,
            transition: "opacity 0.25s",
          }}
        />
        {/* Drawer panel — slides from leading edge.
            translateX direction is reversed in RTL automatically by browsers
            because we use logical insetInlineStart and a percentage transform. */}
        <aside
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            insetInlineStart: 0,
            width: "min(86vw, 320px)",
            background: "var(--bg-elev-1)",
            borderInlineEnd: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            transform: drawerOpen
              ? "translateX(0)"
              : document.documentElement.dir === "rtl"
                ? "translateX(100%)"
                : "translateX(-100%)",
            transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
            paddingTop: "var(--safe-top)",
            paddingBottom: "var(--safe-bottom)",
          }}
        >
          {/* Drawer header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-bold">
              V
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: "var(--text-1)" }}>
                {t("auth.title")}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-3)" }}>
                {t("auth.subtitle")}
              </div>
            </div>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setDrawerOpen(false)}
              aria-label={t("common.close")}
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-3">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors mb-1 ${
                    isActive
                      ? "bg-[var(--accent)]/12 text-[var(--accent)]"
                      : "text-[var(--text-2)] active:bg-white/[0.05]"
                  }`
                }
                style={{ minHeight: 48 }}
              >
                <item.icon size={20} />
                {t(item.i18nKey)}
              </NavLink>
            ))}
          </nav>

          {/* Drawer footer — user info, language, logout */}
          <div className="border-t border-[var(--border)] px-3 py-3 space-y-2">
            <LanguageSwitcher />
            <div className="flex items-center gap-3 rounded-xl px-3 py-2">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-sm font-bold"
                style={{ color: "var(--accent)" }}
              >
                {admin?.full_name?.charAt(0) ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold" style={{ color: "var(--text-1)" }}>
                  {admin?.full_name ?? "Admin"}
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
                  {ROLE_TITLES[admin?.role_level ?? 1]}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn-icon"
                title={t("nav.logout")}
                aria-label={t("nav.logout")}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          MAIN CONTENT
          Desktop: reserve sidebar width.
          Mobile: full width, with bottom padding for the nav bar.
          ───────────────────────────────────────────────────────────────── */}
      <main
        className="lg:ms-[var(--sidebar-w)]"
        style={{
          minWidth: 0,
          overflowX: "hidden",
          paddingBottom: "calc(var(--bottom-nav-h) + var(--safe-bottom) + 8px)",
        }}
      >
        <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8" style={{ minWidth: 0 }}>
          {children}
        </div>
      </main>

      {/* On lg+ screens, no bottom nav and no extra bottom padding. The
          parent main has lg:pb-0 via the override below. */}
      <style>{`
        @media (min-width: 1024px) {
          main { padding-bottom: 0 !important; }
        }
      `}</style>

      {/* ─────────────────────────────────────────────────────────────────
          MOBILE BOTTOM NAV (below lg)
          ───────────────────────────────────────────────────────────────── */}
      <nav className="mobile-bottomnav lg:hidden" aria-label="Primary">
        {bottomNav.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className="flex flex-col items-center justify-center gap-1 flex-1 transition-colors"
              style={{
                minHeight: "var(--tap-min)",
                color: isActive ? "var(--accent)" : "var(--text-2)",
                background: "transparent",
                textDecoration: "none",
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon size={22} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{t(item.i18nKey)}</span>
            </NavLink>
          );
        })}
        {/* "More" tab opens the drawer with all destinations */}
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-1 flex-1"
          onClick={() => setDrawerOpen(true)}
          style={{
            minHeight: "var(--tap-min)",
            color: drawerOpen ? "var(--accent)" : "var(--text-2)",
            background: "transparent",
            border: "none",
          }}
          aria-label={t("nav.dashboard")}
        >
          <MoreHorizontal size={22} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>•••</span>
        </button>
      </nav>
    </div>
  );
}
