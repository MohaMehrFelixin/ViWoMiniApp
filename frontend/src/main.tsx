import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./app/App";

// --- Dark/Light Mode Detection ---
function detectAndApplyTheme() {
  const tg = window.Telegram?.WebApp;
  // Only trust Telegram's colorScheme if actually inside Telegram (has initData)
  const insideTelegram = Boolean(tg?.initData);

  const isDark = insideTelegram
    ? tg?.colorScheme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;

  document.documentElement.classList.toggle("dark", Boolean(isDark));

  // Listen for system changes when outside Telegram
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

detectAndApplyTheme();

// --- Render ---
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
