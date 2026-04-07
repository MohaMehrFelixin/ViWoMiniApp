import { useCallback } from "react";
import { PageShell } from "../components/PageShell";
import { api } from "../api/client";

interface MemberRow { id: number; household_id: number; full_name: string; national_code: string; gender: string; relationship: string; age_group: string; kyc_verified: boolean; created_at: string; }

export function MembersPage() {
  const fetchData = useCallback(async (page: number) => {
    const res = await api.get("members", { searchParams: { page, limit: 25 } }).json<{ members: MemberRow[]; total: number }>();
    return { items: res.members ?? [], total: res.total };
  }, []);

  return (
    <PageShell<MemberRow>
      title="Members"
      subtitle="All household members across the system"
      getRowKey={(r) => r.id}
      fetchData={fetchData}
      columns={[
        { key: "full_name", label: "Name", render: (r) => <span className="font-medium">{r.full_name}</span> },
        { key: "national_code", label: "National Code", render: (r) => <span className="font-mono text-xs">{r.national_code}</span> },
        { key: "relationship", label: "Relation", render: (r) => <span className="text-xs capitalize">{r.relationship}</span> },
        { key: "gender", label: "Gender", render: (r) => <span className="text-xs capitalize">{r.gender}</span> },
        { key: "age_group", label: "Age Group", render: (r) => <span className="text-xs">{r.age_group.replace(/_/g, " ")}</span> },
        { key: "kyc_verified", label: "KYC", render: (r) => <span className="badge" style={{ background: r.kyc_verified ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)", color: r.kyc_verified ? "var(--success)" : "var(--warning)" }}>{r.kyc_verified ? "Verified" : "Pending"}</span> },
      ]}
    />
  );
}
