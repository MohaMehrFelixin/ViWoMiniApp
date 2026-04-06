import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconHome, IconUser, IconMapPin, IconQrScan } from "./Icons";

const TABS = [
  { path: "/", Icon: IconHome, labelKey: "nav.home" },
  { path: "/scanner", Icon: IconQrScan, labelKey: "nav.scan" },
  { path: "/map", Icon: IconMapPin, labelKey: "nav.map" },
  { path: "/profile", Icon: IconUser, labelKey: "nav.profile" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const isMap = location.pathname === "/map";

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
          {TABS.map((tab) => {
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
