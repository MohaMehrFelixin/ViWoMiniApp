import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconHome, IconFamily, IconHistory, IconMapPin } from "./Icons";

const TABS = [
  { path: "/", Icon: IconHome, labelKey: "nav.home" },
  { path: "/household", Icon: IconFamily, labelKey: "nav.household" },
  { path: "/history", Icon: IconHistory, labelKey: "nav.history" },
  { path: "/map", Icon: IconMapPin, labelKey: "nav.map" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const hideTabbar =
    location.pathname.startsWith("/qr") ||
    location.pathname.startsWith("/scanner");

  const isMap = location.pathname === "/map";

  return (
    <div className="flex min-h-screen flex-col">
      <main className={hideTabbar ? "flex-1" : isMap ? "flex-1" : "flex-1 pb-24"}>
        {children}
      </main>

      {!hideTabbar && (
        <div
          className="fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-6"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <nav className="glass-tabbar w-full max-w-sm" role="tablist">
            {TABS.map((tab) => {
              const isActive =
                tab.path === "/"
                  ? location.pathname === "/"
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
      )}
    </div>
  );
}
