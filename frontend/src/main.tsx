import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./app/App";
import { applyThemeParams, disableVerticalSwipes, enableClosingConfirmation } from "./lib/telegram";

// --- Dark/Light Mode Detection ---
function detectAndApplyTheme() {
  const tg = window.Telegram?.WebApp;
  const insideTelegram = Boolean(tg?.initData);

  const isDark = insideTelegram
    ? tg?.colorScheme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;

  document.documentElement.classList.toggle("dark", Boolean(isDark));

  if (!insideTelegram) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        document.documentElement.classList.toggle("dark", e.matches);
      });
  }
}

// --- Telegram WebApp Init ---
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// Apply Telegram theme colors as CSS variables
applyThemeParams();

// Prevent accidental close during important flows
enableClosingConfirmation();

// Prevent swipe-down to minimize while using the app
disableVerticalSwipes();

// Listen for theme changes while app is open
tg?.onEvent?.("themeChanged", () => {
  detectAndApplyTheme();
  applyThemeParams();
});

// Listen for viewport changes (keyboard open/close)
tg?.onEvent?.("viewportChanged", () => {
  document.documentElement.style.setProperty(
    "--tg-viewport-height",
    `${tg.viewportHeight}px`
  );
  document.documentElement.style.setProperty(
    "--tg-viewport-stable-height",
    `${tg.viewportStableHeight}px`
  );
});

// Set initial viewport height
if (tg?.viewportHeight) {
  document.documentElement.style.setProperty("--tg-viewport-height", `${tg.viewportHeight}px`);
  document.documentElement.style.setProperty("--tg-viewport-stable-height", `${tg.viewportStableHeight}px`);
}

detectAndApplyTheme();

// --- Render ---
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
