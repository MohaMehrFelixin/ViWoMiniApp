import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutDashboard, Home, Receipt, TicketCheck, Store, ShieldCheck, ScrollText, Heart, Settings, Megaphone } from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: Command[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} />, action: () => navigate("/"), keywords: "home overview stats" },
    { id: "households", label: "Households", icon: <Home size={16} />, action: () => navigate("/households"), keywords: "family members register" },
    { id: "redemptions", label: "Redemptions", icon: <Receipt size={16} />, action: () => navigate("/redemptions"), keywords: "coupon transaction redeem dispute" },
    { id: "tickets", label: "Support Tickets", icon: <TicketCheck size={16} />, action: () => navigate("/tickets"), keywords: "support issue bug report help" },
    { id: "providers", label: "Providers", icon: <Store size={16} />, action: () => navigate("/providers"), keywords: "distributor store shop service" },
    { id: "volunteers", label: "Volunteers", icon: <Heart size={16} />, action: () => navigate("/volunteers"), keywords: "volunteer specialty help" },
    { id: "users", label: "Admin Users", icon: <ShieldCheck size={16} />, action: () => navigate("/users"), keywords: "admin role permission access" },
    { id: "notices", label: "Notices", icon: <Megaphone size={16} />, action: () => navigate("/notices"), keywords: "notice banner alert announcement" },
    { id: "audit", label: "Audit Trail", icon: <ScrollText size={16} />, action: () => navigate("/audit"), keywords: "log history action track" },
    { id: "settings", label: "Settings", icon: <Settings size={16} />, action: () => navigate("/settings"), keywords: "config system allocation rate limit" },
  ];

  const filtered = query.trim()
    ? commands.filter((c) => {
        const q = query.toLowerCase();
        return c.label.toLowerCase().includes(q) || c.keywords.includes(q);
      })
    : commands;

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      filtered[selected].action();
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div
        className="fixed left-1/2 top-[20%] z-[9999] w-full max-w-lg -translate-x-1/2"
        style={{ animation: "fadeIn 0.1s ease" }}
      >
        <div className="card overflow-hidden" style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)" }}>
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <Search size={16} style={{ color: "var(--text-3)" }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, actions..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-1)" }}
            />
            <kbd className="rounded px-1.5 py-0.5 text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-3)" }}>ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-3)" }}>
                No results found
              </div>
            ) : (
              filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => { cmd.action(); setOpen(false); }}
                  onMouseEnter={() => setSelected(i)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors"
                  style={{
                    background: i === selected ? "rgba(59,130,246,0.12)" : "transparent",
                    color: i === selected ? "var(--accent)" : "var(--text-2)",
                  }}
                >
                  {cmd.icon}
                  <span className="text-sm font-medium">{cmd.label}</span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2">
            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>↑↓ navigate</span>
            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>↵ select</span>
            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>esc close</span>
          </div>
        </div>
      </div>
    </>
  );
}
