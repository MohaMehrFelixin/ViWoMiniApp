import { useEffect, useState, useRef } from "react";
import { api } from "../api/client";
import { Loader2, Plus, Trash2, Save, GripVertical } from "lucide-react";

interface Notice {
  id: string;
  text: string;
  text_fa: string;
  type: "info" | "warning" | "promo";
  link?: string;
  active: boolean;
}

const TYPE_COLORS: Record<string, string> = { info: "#3b82f6", warning: "#f59e0b", promo: "#22c55e" };

export function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const savingRef = useRef(false);

  const fetchNotices = async () => {
    try {
      const res = await api.get("notices").json<{ notices: Notice[] }>();
      setNotices(res.notices ?? []);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchNotices(); }, []);

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      await api.post("notices", { json: notices });
      setMessage("Notices saved — visible to all users now");
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
    savingRef.current = false;
  };

  const addNotice = () => {
    setNotices([...notices, {
      id: `n${Date.now()}`,
      text: "",
      text_fa: "",
      type: "info",
      active: true,
    }]);
  };

  const updateNotice = (index: number, field: keyof Notice, value: string | boolean) => {
    setNotices(notices.map((n, i) => i === index ? { ...n, [field]: value } : n));
  };

  const removeNotice = (index: number) => {
    setNotices(notices.filter((_, i) => i !== index));
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>Notices</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>Manage crisis communication banners shown to all users</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={addNotice}><Plus size={14} /> Add Notice</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Publish
          </button>
        </div>
      </div>

      {message && (
        <div className="card px-4 py-3 text-sm" style={{ borderColor: message.includes("Failed") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)", color: message.includes("Failed") ? "var(--danger)" : "var(--success)" }}>
          {message}
        </div>
      )}

      {notices.length === 0 ? (
        <div className="card p-10 text-center">
          <p style={{ color: "var(--text-3)" }}>No notices. Click "Add Notice" to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice, i) => (
            <div key={notice.id} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <GripVertical size={16} style={{ color: "var(--text-3)" }} />
                <select
                  className="input"
                  style={{ width: 120 }}
                  value={notice.type}
                  onChange={(e) => updateNotice(i, "type", e.target.value)}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="promo">Promo</option>
                </select>
                <div className="h-3 w-3 rounded-full" style={{ background: TYPE_COLORS[notice.type] }} />
                <div className="flex-1" />
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-2)" }}>
                  <input
                    type="checkbox"
                    checked={notice.active}
                    onChange={(e) => updateNotice(i, "active", e.target.checked)}
                  />
                  Active
                </label>
                <button
                  className="btn btn-danger"
                  onClick={() => removeNotice(i)}
                  style={{ padding: "6px 10px" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-2">
                <input
                  className="input"
                  placeholder="English text"
                  value={notice.text}
                  onChange={(e) => updateNotice(i, "text", e.target.value)}
                />
                <input
                  className="input"
                  placeholder="متن فارسی"
                  dir="rtl"
                  value={notice.text_fa}
                  onChange={(e) => updateNotice(i, "text_fa", e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Link URL (optional)"
                  value={notice.link || ""}
                  onChange={(e) => updateNotice(i, "link", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {notices.filter((n) => n.active).length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-1)" }}>Preview (as seen in Mini App)</h2>
          <div className="max-w-sm mx-auto space-y-2">
            {notices.filter((n) => n.active && n.text).map((n) => (
              <div key={n.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: `${TYPE_COLORS[n.type]}10`, border: `1px solid ${TYPE_COLORS[n.type]}30` }}>
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLORS[n.type] }} />
                <p className="text-xs flex-1" style={{ color: "var(--text-1)" }}>{n.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
