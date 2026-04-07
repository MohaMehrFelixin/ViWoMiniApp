import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { getDashboardStats, getRedemptionsByDay, getCategoryDistribution } from "../api/admin";
import { ROLE_TITLES } from "../lib/types";
import type { DashboardStats } from "../lib/types";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Home, Receipt, AlertTriangle, ShieldAlert,
  TicketCheck, Store, Package, Zap, Loader2, Users, Download,
} from "lucide-react";

const CAT_COLORS: Record<string, string> = {
  water: "#3b82f6", food: "#22c55e", fuel: "#f97316",
  hygiene: "#a855f7", medical: "#ef4444", energy: "#eab308",
};

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-1)" }}>{value}</p>
          {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{sub}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <div style={{ color }}>{icon}</div>
      <span className="flex-1 text-sm" style={{ color: "var(--text-2)" }}>{label}</span>
      <span className="badge" style={{ background: `${color}18`, color }}>{count}</span>
    </div>
  );
}

export function DashboardPage() {
  const { admin } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lineData, setLineData] = useState<Array<{ day: string; count: number }>>([]);
  const [pieData, setPieData] = useState<Array<{ category: string; total: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, rd, cd] = await Promise.allSettled([
          getDashboardStats(),
          getRedemptionsByDay(14),
          getCategoryDistribution(),
        ]);

        if (s.status === "fulfilled") setStats(s.value);
        else setStats({ total_households: 0, active_households: 0, today_redemptions: 0, today_redemption_value: "0", open_disputes: 0, pending_kyc: 0, low_stock_centers: 0, active_swaps: 0, pending_tickets: 0, pending_providers: 0, pending_offerings: 0 });

        if (rd.status === "fulfilled" && rd.value.data) {
          // Aggregate by day
          const byDay: Record<string, number> = {};
          for (const row of rd.value.data) {
            byDay[row.day] = (byDay[row.day] || 0) + row.count;
          }
          setLineData(Object.entries(byDay).map(([day, count]) => ({ day: day.slice(5), count })));
        }

        if (cd.status === "fulfilled" && cd.value.data) {
          setPieData(cd.value.data.map((d) => ({ category: d.category, total: d.total })));
        }
      } catch { /* handled by allSettled */ }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!stats) return null;

  const handleExport = (type: string) => {
    const token = sessionStorage.getItem("admin_token");
    const url = `/api/v1/admin/export/${type}`;
    // Open in new tab with auth header via fetch+blob
    fetch(url, { headers: { Authorization: `Session ${token ?? ""}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${type}.csv`;
        a.click();
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-1)" }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
            Welcome back, {admin?.full_name} · {ROLE_TITLES[admin?.role_level ?? 1]}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => handleExport("households")}><Download size={14} /> Households</button>
          <button className="btn" onClick={() => handleExport("redemptions")}><Download size={14} /> Redemptions</button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Households" value={Number(stats.total_households).toLocaleString()} icon={<Home size={20} />} color="#3b82f6" sub={`${Number(stats.active_households).toLocaleString()} active`} />
        <StatCard label="Today's Redemptions" value={Number(stats.today_redemptions).toLocaleString()} icon={<Receipt size={20} />} color="#22c55e" sub={`${stats.today_redemption_value} total value`} />
        <StatCard label="Open Disputes" value={stats.open_disputes} icon={<AlertTriangle size={20} />} color="#ef4444" />
        <StatCard label="Pending KYC" value={stats.pending_kyc} icon={<Users size={20} />} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Low Stock Centers" value={stats.low_stock_centers} icon={<ShieldAlert size={20} />} color="#f97316" />
        <StatCard label="Active Swaps" value={stats.active_swaps} icon={<Zap size={20} />} color="#eab308" />
        <StatCard label="Pending Tickets" value={stats.pending_tickets} icon={<TicketCheck size={20} />} color="#a855f7" />
        <StatCard label="Pending Providers" value={stats.pending_providers} icon={<Store size={20} />} color="#06b6d4" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Redemptions over time */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-1)" }}>Redemptions (14 days)</h2>
          {lineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px]" style={{ color: "var(--text-3)" }}>
              <p className="text-sm">No redemption data yet</p>
            </div>
          )}
        </div>

        {/* Category distribution */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-1)" }}>Category Distribution</h2>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                    {pieData.map((entry) => (
                      <Cell key={entry.category} fill={CAT_COLORS[entry.category] ?? "#666"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map((d) => (
                  <div key={d.category} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[d.category] ?? "#666" }} />
                    <span className="text-xs capitalize" style={{ color: "var(--text-2)" }}>{d.category}</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{d.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[160px]" style={{ color: "var(--text-3)" }}>
              <p className="text-sm">No category data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Attention needed */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-1)" }}>Needs Attention</h2>
        <div className="space-y-2">
          <AlertCard label="Open disputes requiring resolution" count={stats.open_disputes} color="#ef4444" icon={<AlertTriangle size={16} />} />
          <AlertCard label="KYC verifications pending review" count={stats.pending_kyc} color="#f59e0b" icon={<Users size={16} />} />
          <AlertCard label="Support tickets awaiting response" count={stats.pending_tickets} color="#a855f7" icon={<TicketCheck size={16} />} />
          <AlertCard label="Provider applications to review" count={stats.pending_providers} color="#06b6d4" icon={<Store size={16} />} />
          <AlertCard label="Product offerings to process" count={stats.pending_offerings} color="#22c55e" icon={<Package size={16} />} />
          <AlertCard label="Distribution centers with low stock" count={stats.low_stock_centers} color="#f97316" icon={<ShieldAlert size={16} />} />
        </div>
      </div>
    </div>
  );
}
