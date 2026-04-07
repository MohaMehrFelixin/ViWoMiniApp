import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { listAdmins } from "../api/admin";
import { ROLE_TITLES } from "../lib/types";
import type { AdminUser } from "../lib/types";

const STATUS_COLORS: Record<string, string> = { active: "#22c55e", suspended: "#ef4444", deactivated: "#6b7280" };

export function AdminUsersPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await listAdmins(page, 25);
    return { items: res.admins ?? [], total: res.total };
  }, []);

  return (
    <PageShell<AdminUser>
      title="Admin Users"
      subtitle="Manage admin panel access"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "full_name", label: "Name", render: (r) => <span className="font-medium">{r.full_name}</span> },
        { key: "national_code", label: "National Code", render: (r) => <span className="font-mono text-xs">{r.national_code}</span> },
        { key: "role_level", label: "Role", render: (r) => (
          <div className="flex items-center gap-2">
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded text-[10px] font-bold" style={{ background: "rgba(59,130,246,0.15)", color: "var(--accent)" }}>
              L{r.role_level}
            </span>
            <span className="text-xs">{ROLE_TITLES[r.role_level]}</span>
          </div>
        )},
        { key: "status", label: "Status", render: (r) => <span className="badge" style={{ background: `${STATUS_COLORS[r.status] ?? "#666"}18`, color: STATUS_COLORS[r.status] }}>{r.status}</span> },
        { key: "last_login_at", label: "Last Login", render: (r) => r.last_login_at ? new Date(r.last_login_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : <span style={{ color: "var(--text-3)" }}>Never</span> },
      ]}
      actions={<button className="btn btn-primary">+ Add Admin</button>}
    />
  );
}
