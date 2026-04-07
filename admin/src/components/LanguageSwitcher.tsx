import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

// Compact language toggle for the sidebar footer. Two languages → simple
// segmented control. The i18n side-effect on languageChanged updates the
// <html dir/lang/font-fa> automatically so we don't need to do anything else.
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  const setLang = (lang: "fa" | "en") => {
    if (lang !== current) {
      void i18n.changeLanguage(lang);
    }
  };

  return (
    <div
      className="flex items-center gap-1 rounded-lg px-1 py-1"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)",
      }}
      role="radiogroup"
      aria-label="Language"
    >
      <Globe size={12} style={{ color: "var(--text-3)", marginInlineStart: 4 }} />
      <button
        type="button"
        role="radio"
        aria-checked={current === "fa"}
        onClick={() => setLang("fa")}
        style={{
          padding: "3px 10px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: current === "fa" ? "var(--accent)" : "transparent",
          color: current === "fa" ? "#fff" : "var(--text-2)",
          border: "none",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        فا
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={current === "en"}
        onClick={() => setLang("en")}
        style={{
          padding: "3px 10px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          background: current === "en" ? "var(--accent)" : "transparent",
          color: current === "en" ? "#fff" : "var(--text-2)",
          border: "none",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        EN
      </button>
    </div>
  );
}
