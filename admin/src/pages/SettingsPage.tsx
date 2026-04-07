import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Loader2, Save } from "lucide-react";

interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchSettings = async () => {
    try {
      const res = await api.get("settings").json<{ settings: Setting[] }>();
      setSettings(res.settings ?? []);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (key: string) => {
    setSaving(true);
    setMessage("");
    try {
      // Parse to ensure valid JSON
      const parsed = JSON.parse(editValue);
      await api.put(`settings/${key}`, { json: { value: parsed } });
      setMessage(`${key} updated`);
      setEditKey(null);
      fetchSettings();
    } catch (err) {
      setMessage(err instanceof SyntaxError ? "Invalid JSON" : "Failed to save");
    }
    setSaving(false);
  };

  const LABELS: Record<string, string> = {
    weekly_release_pcts: "Weekly Release Schedule (%)",
    qr_expiry_minutes: "QR Code Expiry (minutes)",
    geosearch_radius_km: "Center Search Radius (km)",
    session_timeout_minutes: "Admin Session Timeout (min)",
    max_otp_attempts: "Max OTP Attempts",
    otp_cooldown_minutes: "OTP Cooldown (min)",
    lockout_threshold: "Lockout After N Failures",
    lockout_duration_minutes: "Lockout Duration (min)",
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>System Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>Configure allocation engine, security, and system parameters</p>
      </div>

      {message && (
        <div className="card px-4 py-3 text-sm" style={{ borderColor: message.includes("Invalid") || message.includes("Failed") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)", color: message.includes("Invalid") || message.includes("Failed") ? "var(--danger)" : "var(--success)" }}>
          {message}
        </div>
      )}

      <div className="space-y-3">
        {settings.map((s) => (
          <div key={s.key} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text-1)" }}>{LABELS[s.key] || s.key}</p>
                <p className="font-mono text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{s.key}</p>
              </div>
              {editKey === s.key ? (
                <div className="flex gap-2">
                  <button className="btn" onClick={() => setEditKey(null)} disabled={saving}>Cancel</button>
                  <button className="btn btn-primary" onClick={() => handleSave(s.key)} disabled={saving}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                  </button>
                </div>
              ) : (
                <button className="btn" onClick={() => { setEditKey(s.key); setEditValue(s.value); setMessage(""); }}>Edit</button>
              )}
            </div>

            {editKey === s.key ? (
              <textarea
                className="input mt-3 font-mono text-xs"
                rows={3}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={{ resize: "vertical" }}
              />
            ) : (
              <pre className="mt-3 rounded-lg px-3 py-2 text-xs font-mono overflow-x-auto" style={{ background: "rgba(255,255,255,0.02)", color: "var(--text-2)" }}>
                {s.value}
              </pre>
            )}

            <p className="text-[10px] mt-2" style={{ color: "var(--text-3)" }}>
              Updated: {new Date(s.updated_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
