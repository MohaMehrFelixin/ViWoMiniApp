import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconHome, IconUser, IconMapPin, IconQrScan, IconStore } from "./Icons";
import { useProviderStore, isProfileStale } from "../store/useProviderStore";

interface TabDef {
  path: string;
  Icon: typeof IconHome;
  labelKey: string;
}

const BASE_TABS: TabDef[] = [
  { path: "/", Icon: IconHome, labelKey: "nav.home" },
  { path: "/scanner", Icon: IconQrScan, labelKey: "nav.scan" },
  { path: "/map", Icon: IconMapPin, labelKey: "nav.map" },
  { path: "/profile", Icon: IconUser, labelKey: "nav.profile" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const providerProfile = useProviderStore((s) => s.profile);
  const checked = useProviderStore((s) => s.checked);
  const fetchProviderProfile = useProviderStore((s) => s.fetchProfile);

  // Fetch provider profile once on mount. Skip if already checked this session
  // (prevents repeated 404s for non-providers). Re-fetch if stale.
  useEffect(() => {
    if (!checked || isProfileStale()) {
      fetchProviderProfile();
    }
  }, [checked, fetchProviderProfile]);

  const isMap = location.pathname === "/map";

  // Show provider tab when user is an approved distributor or service provider
  const tabs = useMemo((): TabDef[] => {
    if (providerProfile && providerProfile.status === "approved") {
      const providerTab: TabDef = { path: "/provider", Icon: IconStore, labelKey: "nav.store" };
      // Home, Scan, [Store], Map, Profile
      return [
        ...BASE_TABS.slice(0, 2),
        providerTab,
        ...BASE_TABS.slice(2),
      ];
    }
    return BASE_TABS;
  }, [providerProfile]);

  return (
    <div className={isMap ? "h-dvh flex flex-col overflow-hidden" : "flex min-h-screen flex-col"}>
      <main className={isMap ? "flex-1 min-h-0" : "flex-1 pb-24"}>
        {children}
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-6"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <nav className="glass-tabbar w-full max-w-sm" role="tablist">
          {tabs.map((tab) => {
            const isActive =
              tab.path === "/"
                ? location.pathname === "/" || location.pathname.startsWith("/category")
                : location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                role="tab"
                aria-selected={isActive}
                aria-label={t(tab.labelKey)}
                onClick={() => {
                  navigate(tab.path);
                  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
                }}
                className={`glass-tab ${isActive ? "glass-tab-active" : ""}`}
              >
                <tab.Icon size={20} />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
