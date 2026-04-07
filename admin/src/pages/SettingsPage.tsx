import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listSettings,
  updateSetting,
} from "../api/admin";
import {
  Loader2, Save, RotateCcw, Check, AlertCircle, Sliders, Shield, Gauge,
  Send, Activity, Package, Plus, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { useToast } from "../components/Toast";
import { extractErrorMessage } from "../lib/errors";

// =============================================================================
// SETTINGS REGISTRY
// =============================================================================
//
// Every known setting has a typed metadata entry. This drives:
//   - Which group/section it appears in
//   - The friendly label and description
//   - Which editor component renders it
//   - Validation and unit display
//
// Unknown keys (settings the admin added manually) fall through to a generic
// JSON editor so the page never breaks on missing metadata.

type SettingGroup = "allocation" | "security" | "limits" | "telegram";

type EditorKind =
  | "number"
  | "weekly_pcts"
  | "kyc_factors"
  | "location_factors"
  | "age_matrix"
  | "flag_multipliers"
  | "rate_limits"
  | "telegram_bot"
  | "json";

interface SettingMeta {
  key: string;
  group: SettingGroup;
  label: string;
  description: string;
  editor: EditorKind;
  unit?: string;
  min?: number;
  max?: number;
  liveReload?: boolean; // If true, editing this hot-reloads the allocation engine
}

const REGISTRY: Record<string, SettingMeta> = {
  // ── Allocation engine (hot-reloaded) ──
  allocation_base_amounts: {
    key: "allocation_base_amounts",
    group: "allocation",
    label: "Base Allocation Amounts",
    description: "Per-person monthly amounts for each age group and category. These are the foundation of every household's allocation calculation.",
    editor: "age_matrix",
    liveReload: true,
  },
  special_flag_multipliers: {
    key: "special_flag_multipliers",
    group: "allocation",
    label: "Special Flag Multipliers",
    description: "Multipliers applied when a member has a special condition (pregnant, chronic illness, etc.). Only the highest applicable multiplier per category is used.",
    editor: "flag_multipliers",
    liveReload: true,
  },
  location_multipliers: {
    key: "location_multipliers",
    group: "allocation",
    label: "Location Multipliers",
    description: "Adjustment factors based on the household's region. Tehran is reduced (0.80x) due to higher access; rural areas get more (1.20x).",
    editor: "location_factors",
    liveReload: true,
  },
  kyc_tier_factors: {
    key: "kyc_tier_factors",
    group: "allocation",
    label: "KYC Tier Factors",
    description: "Allocation reduction by KYC verification level. Fully verified households (Tier 1) get 100%, semi-verified 85%, offline-only 70%.",
    editor: "kyc_factors",
    liveReload: true,
  },
  weekly_release_pcts: {
    key: "weekly_release_pcts",
    group: "allocation",
    label: "Weekly Release Schedule",
    description: "Percentage of the monthly allocation released each week. Must total 100%. Default: 35/25/25/15 (front-loaded).",
    editor: "weekly_pcts",
    liveReload: true,
  },

  // ── Security ──
  max_otp_attempts: {
    key: "max_otp_attempts",
    group: "security",
    label: "Max OTP Attempts",
    description: "How many wrong OTP codes a user can enter before they're locked out.",
    editor: "number",
    min: 1,
    max: 10,
  },
  otp_cooldown_minutes: {
    key: "otp_cooldown_minutes",
    group: "security",
    label: "OTP Cooldown",
    description: "Minimum time between OTP request retries.",
    editor: "number",
    unit: "min",
    min: 1,
    max: 60,
  },
  lockout_threshold: {
    key: "lockout_threshold",
    group: "security",
    label: "Lockout After N Failures",
    description: "How many failed login attempts before the account is temporarily locked.",
    editor: "number",
    min: 1,
    max: 20,
  },
  lockout_duration_minutes: {
    key: "lockout_duration_minutes",
    group: "security",
    label: "Lockout Duration",
    description: "How long an account stays locked after exceeding the threshold.",
    editor: "number",
    unit: "min",
    min: 1,
    max: 1440,
  },
  session_timeout_minutes: {
    key: "session_timeout_minutes",
    group: "security",
    label: "Admin Session Timeout",
    description: "Inactive admin sessions are automatically destroyed after this period.",
    editor: "number",
    unit: "min",
    min: 5,
    max: 1440,
  },

  // ── Limits & quotas ──
  qr_expiry_minutes: {
    key: "qr_expiry_minutes",
    group: "limits",
    label: "QR Code Expiry",
    description: "How long a generated redemption QR code stays valid before it must be regenerated.",
    editor: "number",
    unit: "min",
    min: 1,
    max: 60,
  },
  geosearch_radius_km: {
    key: "geosearch_radius_km",
    group: "limits",
    label: "Center Search Radius",
    description: "Maximum distance to search for nearby distribution centers when a household opens the map.",
    editor: "number",
    unit: "km",
    min: 1,
    max: 500,
  },
  rate_limits: {
    key: "rate_limits",
    group: "limits",
    label: "API Rate Limits",
    description: "Per-route request rate limits. Each route has a steady rate (req/sec) and a burst allowance.",
    editor: "rate_limits",
  },

  // ── Telegram ──
  telegram_bot: {
    key: "telegram_bot",
    group: "telegram",
    label: "Telegram Bot",
    description: "Connection details for the Telegram Mini App bot.",
    editor: "telegram_bot",
  },
};

const GROUP_META: Record<SettingGroup, { title: string; subtitle: string; icon: React.ComponentType<{ size?: number }>; color: string }> = {
  allocation: {
    title: "Allocation Engine",
    subtitle: "Live-reloaded — changes here update household calculations immediately",
    icon: Sliders,
    color: "#3b82f6",
  },
  security: {
    title: "Security & Access",
    subtitle: "Authentication, lockout, and session policies",
    icon: Shield,
    color: "#22c55e",
  },
  limits: {
    title: "Limits & Quotas",
    subtitle: "Rate limits, expirations, and search bounds",
    icon: Gauge,
    color: "#f59e0b",
  },
  telegram: {
    title: "Telegram Integration",
    subtitle: "Bot connection and Mini App config",
    icon: Send,
    color: "#a855f7",
  },
};

const GROUP_ORDER: SettingGroup[] = ["allocation", "security", "limits", "telegram"];

// Friendly labels for various ids that appear in setting values.
const AGE_LABELS: Record<string, string> = {
  infant_0_6m: "Infant 0–6 mo",
  infant_6_23m: "Infant 6–23 mo",
  child_2_4: "Child 2–4",
  child_5_11: "Child 5–11",
  teen_12_17: "Teen 12–17",
  adult_18_59: "Adult 18–59",
  senior_60_64: "Senior 60–64",
  elderly_65p: "Elderly 65+",
};

const CATEGORIES = ["water", "food", "fuel", "hygiene", "medical", "energy"] as const;

const FLAG_LABELS: Record<string, string> = {
  pregnant: "Pregnant",
  chronic: "Chronic illness",
  sanitary: "Sanitary needs",
  disability: "Disability",
  newborn: "Newborn",
};

const KYC_TIER_LABELS: Record<string, string> = {
  "1": "Tier 1 — Digital",
  "2": "Tier 2 — Semi-offline",
  "3": "Tier 3 — Offline",
};

const LOCATION_LABELS: Record<string, string> = {
  tehran: "Tehran (high access)",
  urban: "Urban",
  rural: "Rural (lowest access)",
};

const RATE_LIMIT_LABELS: Record<string, string> = {
  qr_generate: "QR Generation",
  redeem: "Redemption",
  kyc_otp: "KYC OTP",
  notices: "Notices (public)",
  admin_auth: "Admin auth",
};

// =============================================================================
// MAIN PAGE
// =============================================================================

interface ParsedSetting {
  meta: SettingMeta;
  rawKey: string;
  value: unknown;
  updatedAt: string;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ParsedSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<SettingGroup>>(new Set());
  const toast = useToast();

  // Translated group metadata. Uses i18n keys instead of the hardcoded
  // English strings in GROUP_META above. Falls back to the hardcoded values
  // for backwards compatibility if a translation key is missing.
  const groupTitles: Record<SettingGroup, { title: string; subtitle: string }> = {
    allocation: {
      title: t("settings.groups.allocationTitle"),
      subtitle: t("settings.groups.allocationSubtitle"),
    },
    security: {
      title: t("settings.groups.securityTitle"),
      subtitle: t("settings.groups.securitySubtitle"),
    },
    limits: {
      title: t("settings.groups.limitsTitle"),
      subtitle: t("settings.groups.limitsSubtitle"),
    },
    telegram: {
      title: t("settings.groups.telegramTitle"),
      subtitle: t("settings.groups.telegramSubtitle"),
    },
  };

  const fetchSettings = useCallback(async () => {
    try {
      const res = await listSettings();
      const parsed: ParsedSetting[] = (res.settings ?? []).map((s) => {
        // Backend returns the JSONB value as a string. Try to parse to a real
        // JS value; fall back to the raw string for unknown formats.
        let v: unknown;
        try {
          v = JSON.parse(s.value);
        } catch {
          v = s.value;
        }
        return {
          rawKey: s.key,
          meta: REGISTRY[s.key] ?? {
            key: s.key,
            group: "limits",
            label: s.key,
            description: t("settings.customSetting"),
            editor: "json",
          },
          value: v,
          updatedAt: s.updated_at,
        };
      });
      setSettings(parsed);
    } catch (err) {
      toast.error(await extractErrorMessage(err, "Failed to load settings"));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Save a single setting. The editor reports back the new value already
  // in its native shape (object, array, number, etc.).
  const handleSave = async (key: string, newValue: unknown) => {
    setSavingKey(key);
    try {
      await updateSetting(key, newValue);
      const reloaded = REGISTRY[key]?.liveReload;
      toast.success(
        reloaded
          ? t("settings.engineReloaded", { key })
          : t("settings.saved", { key })
      );
      await fetchSettings();
    } catch (err) {
      toast.error(await extractErrorMessage(err, t("errors.saveFailed")));
    }
    setSavingKey(null);
  };

  const grouped = useMemo(() => {
    const out: Record<SettingGroup, ParsedSetting[]> = {
      allocation: [],
      security: [],
      limits: [],
      telegram: [],
    };
    for (const s of settings) {
      out[s.meta.group].push(s);
    }
    return out;
  }, [settings]);

  const toggleGroup = (g: SettingGroup) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6" style={{ maxWidth: "100%", minWidth: 0 }}>
      <div>
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: "var(--text-1)" }}>
          {t("settings.title")}
        </h1>
        <p className="text-xs md:text-sm mt-0.5 md:mt-1" style={{ color: "var(--text-3)" }}>
          {t("settings.subtitle")}
        </p>
      </div>

      {GROUP_ORDER.map((g) => {
        const items = grouped[g];
        if (items.length === 0) return null;
        const meta = GROUP_META[g];
        const titles = groupTitles[g];
        const Icon = meta.icon;
        const isCollapsed = collapsed.has(g);
        return (
          <section key={g} className="card" style={{ overflow: "hidden" }}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(g)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                background: "transparent",
                border: "none",
                borderBottom: isCollapsed ? "none" : "1px solid var(--border)",
                cursor: "pointer",
                textAlign: "start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${meta.color}18`,
                  color: meta.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm font-semibold flex items-center gap-2 flex-wrap" style={{ color: "var(--text-1)" }}>
                  {titles.title}
                  {g === "allocation" && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                      style={{ background: "rgba(34,197,94,0.15)", color: "var(--success)" }}
                    >
                      <Activity size={9} /> {t("settings.live")}
                    </span>
                  )}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  {titles.subtitle}
                </div>
              </div>
              <span style={{ color: "var(--text-3)" }}>
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>

            {!isCollapsed && (
              <div style={{ padding: "8px 0" }}>
                {items.map((s) => (
                  <SettingRow
                    key={s.rawKey}
                    setting={s}
                    saving={savingKey === s.rawKey}
                    onSave={(v) => handleSave(s.rawKey, v)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// =============================================================================
// SETTING ROW (per-setting card with editor)
// =============================================================================

interface SettingRowProps {
  setting: ParsedSetting;
  saving: boolean;
  onSave: (newValue: unknown) => void;
}

function SettingRow({ setting, saving, onSave }: SettingRowProps) {
  const { t } = useTranslation();
  const { meta, value, updatedAt } = setting;
  const [draft, setDraft] = useState<unknown>(value);
  const [error, setError] = useState<string | null>(null);

  // Re-sync draft when the upstream value changes (after a save).
  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  const dirty = useMemo(() => {
    try {
      return JSON.stringify(draft) !== JSON.stringify(value);
    } catch {
      return false;
    }
  }, [draft, value]);

  const handleReset = () => {
    setDraft(value);
    setError(null);
  };

  const handleSubmit = () => {
    if (error) return;
    onSave(draft);
  };

  // Look up translated label / description from i18n. Fall back to the
  // English defaults in REGISTRY for unknown / custom keys.
  const labelKey = `settings.labels.${meta.key}`;
  const descKey = `settings.descriptions.${meta.key}`;
  const translatedLabel = t(labelKey, meta.label);
  const translatedDesc = t(descKey, meta.description);

  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        minWidth: 0,
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap" style={{ minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              {translatedLabel}
            </h3>
            <code
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-3)" }}
            >
              {meta.key}
            </code>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)", lineHeight: 1.5 }}>
            {translatedDesc}
          </p>
        </div>
        {dirty && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              className="btn"
              onClick={handleReset}
              disabled={saving}
              style={{ padding: "6px 10px" }}
              aria-label="Reset"
            >
              <RotateCcw size={12} />
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving || !!error}
              style={{ padding: "6px 12px" }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* Editor — content scrolls within this container, never overflows the page. */}
      <div style={{ minWidth: 0, overflowX: "auto" }}>
        <Editor meta={meta} value={draft} onChange={setDraft} onError={setError} />
      </div>

      {error && (
        <div
          className="mt-2 flex items-center gap-2 text-xs"
          style={{ color: "var(--danger)" }}
        >
          <AlertCircle size={12} /> {error}
        </div>
      )}

      <div className="text-[10px] mt-3" style={{ color: "var(--text-3)" }}>
        {t("common.lastUpdated")}: {new Date(updatedAt).toLocaleString()}
      </div>
    </div>
  );
}

// =============================================================================
// EDITOR DISPATCHER
// =============================================================================

interface EditorProps {
  meta: SettingMeta;
  value: unknown;
  onChange: (next: unknown) => void;
  onError: (err: string | null) => void;
}

function Editor({ meta, value, onChange, onError }: EditorProps) {
  switch (meta.editor) {
    case "number":
      return <NumberEditor meta={meta} value={value} onChange={onChange} onError={onError} />;
    case "weekly_pcts":
      return <WeeklyPctsEditor value={value} onChange={onChange} onError={onError} />;
    case "kyc_factors":
      return (
        <FactorsEditor
          value={value}
          labels={KYC_TIER_LABELS}
          onChange={onChange}
          onError={onError}
        />
      );
    case "location_factors":
      return (
        <FactorsEditor
          value={value}
          labels={LOCATION_LABELS}
          onChange={onChange}
          onError={onError}
        />
      );
    case "age_matrix":
      return <AgeMatrixEditor value={value} onChange={onChange} onError={onError} />;
    case "flag_multipliers":
      return <FlagMultipliersEditor value={value} onChange={onChange} onError={onError} />;
    case "rate_limits":
      return <RateLimitsEditor value={value} onChange={onChange} onError={onError} />;
    case "telegram_bot":
      return <TelegramBotEditor value={value} />;
    case "json":
    default:
      return <JsonEditor value={value} onChange={onChange} onError={onError} />;
  }
}

// =============================================================================
// EDITOR: NUMBER (single integer/float with unit)
// =============================================================================

function NumberEditor({ meta, value, onChange, onError }: EditorProps) {
  // The setting is stored as a JSON number; we render an `<input type=number>`
  // and pass the parsed value back. Validation enforces min/max from registry.
  const initial = typeof value === "number" ? value : Number(value);
  const [text, setText] = useState(String(isNaN(initial) ? "" : initial));

  useEffect(() => {
    setText(String(typeof value === "number" ? value : value ?? ""));
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    if (next === "") {
      onError("Required");
      return;
    }
    const n = Number(next);
    if (isNaN(n)) {
      onError("Must be a number");
      return;
    }
    if (meta.min !== undefined && n < meta.min) {
      onError(`Minimum is ${meta.min}`);
      return;
    }
    if (meta.max !== undefined && n > meta.max) {
      onError(`Maximum is ${meta.max}`);
      return;
    }
    onError(null);
    onChange(n);
  };

  return (
    <div className="flex items-center gap-3" style={{ maxWidth: 320 }}>
      <input
        className="input"
        type="number"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        min={meta.min}
        max={meta.max}
        style={{ minWidth: 0 }}
      />
      {meta.unit && (
        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-2)" }}>
          {meta.unit}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// EDITOR: WEEKLY RELEASE PERCENTAGES (4-week schedule, sum=100)
// =============================================================================

function WeeklyPctsEditor({ value, onChange, onError }: Omit<EditorProps, "meta">) {
  const { t } = useTranslation();
  const arr = Array.isArray(value) && value.length === 4 ? (value as number[]) : [25, 25, 25, 25];
  const sum = arr.reduce((a, b) => a + (Number(b) || 0), 0);

  const update = (i: number, next: string) => {
    const n = Number(next);
    if (isNaN(n) || n < 0 || n > 100) {
      onError("0-100");
      return;
    }
    const updated = [...arr];
    updated[i] = n;
    const newSum = updated.reduce((a, b) => a + b, 0);
    if (newSum !== 100) {
      onError(t("settings.weekly.totalSum", { sum: newSum }));
    } else {
      onError(null);
    }
    onChange(updated);
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ maxWidth: 480 }}>
        {arr.map((v, i) => (
          <div key={i}>
            <label
              className="block text-[10px] mb-1 uppercase tracking-wide"
              style={{ color: "var(--text-3)" }}
            >
              {t("settings.weekly.week", { n: i + 1 })}
            </label>
            <div className="flex items-center gap-1">
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={v}
                onChange={(e) => update(i, e.target.value)}
                style={{ minWidth: 0 }}
              />
              <span className="text-xs flex-shrink-0" style={{ color: "var(--text-3)" }}>
                %
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        className="mt-3 text-xs flex items-center gap-2"
        style={{ color: sum === 100 ? "var(--success)" : "var(--warning)" }}
      >
        {sum === 100 ? <Check size={12} /> : <AlertCircle size={12} />}
        {t("settings.weekly.totalSum", { sum })}{" "}
        {sum !== 100 && `(${t("settings.weekly.mustEqual100")})`}
      </div>
    </div>
  );
}

// =============================================================================
// EDITOR: GENERIC LABELED FACTORS (kyc_tier, location_multipliers)
// =============================================================================

interface FactorsEditorProps extends Omit<EditorProps, "meta"> {
  labels: Record<string, string>;
}

function FactorsEditor({ value, labels, onChange, onError }: FactorsEditorProps) {
  const { t } = useTranslation();
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, number>;
  const keys = Object.keys(obj).sort();
  // Resolve label via i18n if a key matches the kyc tier or location set;
  // fall back to the hardcoded English labels prop.
  const resolveLabel = (k: string) => {
    // Try kyc tier translation first.
    const tierTrans = t(`settings.kycTiers.${k}`, { defaultValue: "" });
    if (tierTrans) return tierTrans;
    const locTrans = t(`settings.locationLabels.${k}`, { defaultValue: "" });
    if (locTrans) return locTrans;
    return labels[k] ?? k;
  };

  const update = (key: string, next: string) => {
    const n = Number(next);
    if (isNaN(n) || n < 0) {
      onError("Must be a non-negative number");
      return;
    }
    onError(null);
    onChange({ ...obj, [key]: n });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ maxWidth: 720 }}>
      {keys.map((k) => {
        const num = Number(obj[k]) || 0;
        const pct = Math.round(num * 100);
        return (
          <div key={k}>
            <label
              className="block text-[10px] mb-1 uppercase tracking-wide"
              style={{ color: "var(--text-3)" }}
            >
              {resolveLabel(k)}
            </label>
            <div className="flex items-center gap-2">
              <input
                className="input"
                type="number"
                step="0.01"
                min={0}
                value={num}
                onChange={(e) => update(k, e.target.value)}
                style={{ minWidth: 0 }}
              />
              <span
                className="text-[10px] flex-shrink-0 px-2 py-0.5 rounded"
                style={{
                  background: pct === 100 ? "rgba(34,197,94,0.12)" : pct < 100 ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)",
                  color: pct === 100 ? "var(--success)" : pct < 100 ? "var(--warning)" : "var(--accent)",
                }}
              >
                {pct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// EDITOR: AGE × CATEGORY MATRIX (allocation_base_amounts)
// =============================================================================

function AgeMatrixEditor({ value, onChange, onError }: Omit<EditorProps, "meta">) {
  const { t } = useTranslation();
  const obj = (value && typeof value === "object" ? value : {}) as Record<
    string,
    Record<string, string | number>
  >;
  const ageGroups = Object.keys(AGE_LABELS).filter((k) => obj[k] !== undefined);
  // Add any custom age groups not in the friendly map.
  for (const k of Object.keys(obj)) {
    if (!ageGroups.includes(k)) ageGroups.push(k);
  }

  const update = (age: string, cat: string, next: string) => {
    const n = next === "" ? 0 : Number(next);
    if (isNaN(n) || n < 0) {
      onError(`${age}/${cat} must be ≥ 0`);
      return;
    }
    onError(null);
    // Preserve the original storage format (string vs number) so backend
    // round-trips don't change types.
    const original = obj[age]?.[cat];
    const storeAs: string | number = typeof original === "string" ? next : n;
    onChange({
      ...obj,
      [age]: { ...obj[age], [cat]: storeAs },
    });
  };

  return (
    <div className="overflow-x-auto" style={{ maxWidth: "100%" }}>
      <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                left: 0,
                background: "var(--bg)",
                textAlign: "start",
                padding: "8px 12px",
                color: "var(--text-3)",
                fontWeight: 600,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid var(--border)",
                minWidth: 130,
              }}
            >
              {t("settings.ageGroupLabel")}
            </th>
            {CATEGORIES.map((cat) => (
              <th
                key={cat}
                style={{
                  textAlign: "start",
                  padding: "8px 6px",
                  color: "var(--text-3)",
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {t(`settings.categories.${cat}`, cat)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ageGroups.map((age) => (
            <tr key={age}>
              <td
                style={{
                  position: "sticky",
                  left: 0,
                  background: "var(--bg)",
                  padding: "6px 12px",
                  color: "var(--text-2)",
                  fontSize: 11,
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}
              >
                {t(`settings.ageGroups.${age}`, AGE_LABELS[age] ?? age)}
              </td>
              {CATEGORIES.map((cat) => (
                <td
                  key={cat}
                  style={{
                    padding: "4px 4px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min={0}
                    value={obj[age]?.[cat] ?? ""}
                    onChange={(e) => update(age, cat, e.target.value)}
                    style={{
                      width: 76,
                      padding: "5px 8px",
                      fontSize: 12,
                      textAlign: "end",
                    }}
                    aria-label={`${age} ${cat}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// EDITOR: SPECIAL FLAG MULTIPLIERS (sparse: per flag, only some categories)
// =============================================================================

function FlagMultipliersEditor({ value, onChange, onError }: Omit<EditorProps, "meta">) {
  const { t } = useTranslation();
  const obj = (value && typeof value === "object" ? value : {}) as Record<
    string,
    Record<string, number>
  >;
  const flags = Object.keys(obj);

  const updateMultiplier = (flag: string, cat: string, next: string) => {
    const n = Number(next);
    if (isNaN(n) || n < 0) {
      onError(`${flag}/${cat} must be ≥ 0`);
      return;
    }
    onError(null);
    onChange({
      ...obj,
      [flag]: { ...obj[flag], [cat]: n },
    });
  };

  const removeCategory = (flag: string, cat: string) => {
    const flagObj = { ...obj[flag] };
    delete flagObj[cat];
    onChange({ ...obj, [flag]: flagObj });
    onError(null);
  };

  const addCategory = (flag: string) => {
    // Find the first category not already used by this flag.
    const used = Object.keys(obj[flag] ?? {});
    const available = CATEGORIES.find((c) => !used.includes(c));
    if (!available) return;
    onChange({
      ...obj,
      [flag]: { ...obj[flag], [available]: 1.0 },
    });
  };

  return (
    <div className="space-y-4" style={{ maxWidth: 720 }}>
      {flags.map((flag) => {
        const cats = Object.keys(obj[flag] ?? {});
        const usedAll = cats.length >= CATEGORIES.length;
        return (
          <div
            key={flag}
            className="rounded-lg p-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide"
                style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}
              >
                {t(`settings.flags.${flag}`, FLAG_LABELS[flag] ?? flag)}
              </span>
              {!usedAll && (
                <button
                  onClick={() => addCategory(flag)}
                  className="btn"
                  style={{ padding: "2px 8px", fontSize: 10 }}
                >
                  <Plus size={10} /> {t("settings.addCategory")}
                </button>
              )}
            </div>
            {cats.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                {t("settings.noCategories")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {cats.map((cat) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span
                      className="text-xs flex-shrink-0"
                      style={{ color: "var(--text-2)", width: 80 }}
                    >
                      {t(`settings.categories.${cat}`, cat)}
                    </span>
                    <input
                      className="input"
                      type="number"
                      step="0.05"
                      min={0}
                      value={obj[flag][cat]}
                      onChange={(e) => updateMultiplier(flag, cat, e.target.value)}
                      style={{ width: 96, padding: "5px 8px", fontSize: 12 }}
                    />
                    <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                      ×
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => removeCategory(flag, cat)}
                      className="btn btn-danger"
                      style={{ padding: "2px 6px" }}
                      aria-label={`Remove ${cat}`}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// EDITOR: RATE LIMITS (per route: rps + burst)
// =============================================================================

function RateLimitsEditor({ value, onChange, onError }: Omit<EditorProps, "meta">) {
  const { t } = useTranslation();
  const obj = (value && typeof value === "object" ? value : {}) as Record<
    string,
    { rps?: number; burst?: number }
  >;
  const routes = Object.keys(obj);

  const update = (route: string, field: "rps" | "burst", next: string) => {
    const n = Number(next);
    if (isNaN(n) || n < 0) {
      onError(`${route}/${field} must be ≥ 0`);
      return;
    }
    onError(null);
    onChange({
      ...obj,
      [route]: { ...obj[route], [field]: n },
    });
  };

  return (
    <div className="space-y-3" style={{ maxWidth: 720 }}>
      {routes.map((route) => (
        <div
          key={route}
          className="rounded-lg p-3 flex items-center gap-3 flex-wrap"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
        >
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="flex items-center gap-2">
              <Package size={12} style={{ color: "var(--text-3)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>
                {t(`settings.rateLimits.${route}`, RATE_LIMIT_LABELS[route] ?? route)}
              </span>
            </div>
            <code
              className="text-[10px] mt-0.5 block font-mono"
              style={{ color: "var(--text-3)" }}
            >
              {route}
            </code>
          </div>

          <div className="flex items-center gap-1">
            <label className="text-[10px]" style={{ color: "var(--text-3)" }}>
              {t("settings.rps")}
            </label>
            <input
              className="input"
              type="number"
              min={0}
              value={obj[route]?.rps ?? 0}
              onChange={(e) => update(route, "rps", e.target.value)}
              style={{ width: 72, padding: "5px 8px", fontSize: 12 }}
            />
          </div>

          <div className="flex items-center gap-1">
            <label className="text-[10px]" style={{ color: "var(--text-3)" }}>
              {t("settings.burst")}
            </label>
            <input
              className="input"
              type="number"
              min={0}
              value={obj[route]?.burst ?? 0}
              onChange={(e) => update(route, "burst", e.target.value)}
              style={{ width: 72, padding: "5px 8px", fontSize: 12 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// EDITOR: TELEGRAM BOT (read-only display)
// =============================================================================

function TelegramBotEditor({ value }: { value: unknown }) {
  const { t } = useTranslation();
  const obj = (value && typeof value === "object" ? value : {}) as {
    username?: string;
    bot_id?: string;
    enabled?: boolean;
  };
  const enabled = obj.enabled !== false;
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "rgba(168,85,247,0.06)",
        border: "1px solid rgba(168,85,247,0.2)",
        maxWidth: 480,
      }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(168,85,247,0.18)",
            color: "#a855f7",
          }}
        >
          <Send size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>
            @{obj.username ?? "unknown"}
          </div>
          <div className="text-xs font-mono" style={{ color: "var(--text-3)" }}>
            {t("settings.telegramBot.botId")} {obj.bot_id ?? "—"}
          </div>
        </div>
        <span
          className="badge"
          style={{
            background: enabled ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: enabled ? "var(--success)" : "var(--danger)",
          }}
        >
          {enabled ? t("settings.telegramBot.connected") : t("settings.telegramBot.disabled")}
        </span>
      </div>
      <p className="text-[10px] mt-3" style={{ color: "var(--text-3)" }}>
        {t("settings.telegramBot.envHint")}
      </p>
    </div>
  );
}

// =============================================================================
// EDITOR: JSON FALLBACK (for unknown keys)
// =============================================================================

function JsonEditor({ value, onChange, onError }: Omit<EditorProps, "meta">) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));

  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      onError(null);
      onChange(parsed);
    } catch {
      onError("Invalid JSON");
    }
  };

  return (
    <textarea
      className="input"
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      rows={Math.min(12, text.split("\n").length + 1)}
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: 11,
        resize: "vertical",
        minWidth: 0,
        width: "100%",
        maxWidth: "100%",
      }}
    />
  );
}
