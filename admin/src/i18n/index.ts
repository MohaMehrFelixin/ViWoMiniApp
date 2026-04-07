// i18n configuration for the ViWo admin panel.
//
// Behavior:
//   - Two languages: English (en) and Persian (fa).
//   - Default language is Persian (fa).
//   - User selection is persisted in localStorage under VIWO_ADMIN_LANG.
//   - On every language change, document.documentElement.dir and lang are
//     updated automatically. Persian = rtl, English = ltr.
//   - The font-fa class is toggled on <html> so the Vazirmatn web font
//     activates only when Persian is active (English uses the system font).
//
// To translate a string in any component:
//   import { useTranslation } from "react-i18next";
//   const { t } = useTranslation();
//   <h1>{t("nav.dashboard")}</h1>

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import fa from "./fa.json";

const STORAGE_KEY = "VIWO_ADMIN_LANG";
const SUPPORTED = ["en", "fa"] as const;
type SupportedLang = (typeof SUPPORTED)[number];

function detectInitialLanguage(): SupportedLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fa") return stored;
  } catch {
    // localStorage may be blocked in some embedded contexts.
  }
  return "fa"; // default per spec
}

const initialLang = detectInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  // Show the key path if a translation is missing — easier to debug than
  // returning an empty string silently.
  returnNull: false,
  returnEmptyString: false,
});

/**
 * Apply the current language to the document. Sets dir/lang and toggles
 * a CSS class so the Persian font kicks in only when needed.
 */
export function applyLanguage(lang: SupportedLang) {
  const dir = lang === "fa" ? "rtl" : "ltr";
  if (typeof document !== "undefined") {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle("rtl", dir === "rtl");
    document.documentElement.classList.toggle("font-fa", lang === "fa");
  }
}

// Apply on initial load.
applyLanguage(initialLang);

// Persist + apply on every change.
i18n.on("languageChanged", (lng) => {
  if (lng === "en" || lng === "fa") {
    try {
      localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      // Best-effort.
    }
    applyLanguage(lng);
  }
});

export { i18n, SUPPORTED, type SupportedLang };
