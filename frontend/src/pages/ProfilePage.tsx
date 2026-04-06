import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { HouseholdTab } from "./HouseholdPage";
import { IconUser, IconFamily, IconShield } from "../components/Icons";

type Tab = "info" | "household";

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { household } = useHouseholdStore();
  const [activeTab, setActiveTab] = useState<Tab>("info");

  const tabs: { key: Tab; labelKey: string; Icon: typeof IconUser }[] = [
    { key: "info", labelKey: "profile.info", Icon: IconUser },
    { key: "household", labelKey: "profile.household", Icon: IconFamily },
  ];

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-primary text-xl font-bold">{t("profile.title")}</h1>

      {/* Tab Switcher */}
      <div className="glass flex gap-1 p-1" style={{ borderRadius: "14px" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white/20 text-primary shadow-sm"
                : "text-secondary hover:text-primary"
            }`}
          >
            <tab.Icon size={16} />
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && <ProfileInfoTab />}
      {activeTab === "household" && <HouseholdTab />}
    </div>
  );
}

function ProfileInfoTab() {
  const { t } = useTranslation();
  const { household, members } = useHouseholdStore();

  if (!household) {
    return (
      <div className="glass glass-animate p-6 text-center">
        <IconUser size={48} className="text-secondary mx-auto mb-3 opacity-40" />
        <p className="text-secondary text-sm">{t("home.registerFirst")}</p>
      </div>
    );
  }

  const headMember = members.find((m) => m.relationship === "head");

  return (
    <div className="space-y-3">
      {/* User Card */}
      <div className="glass glass-animate p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(59, 130, 246, 0.15)" }}
          >
            <IconUser size={28} color="var(--cat-water)" />
          </div>
          <div className="flex-1">
            <p className="text-primary text-base font-semibold">
              {headMember?.full_name || t("household.head")}
            </p>
            <p className="text-secondary text-xs">
              {headMember?.national_code
                ? `${t("household.nationalCode")}: ${headMember.national_code}`
                : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Household Info */}
      <div className="glass glass-animate space-y-3 p-4" style={{ animationDelay: "50ms" }}>
        <InfoRow label={t("household.householdCode")} value={household.household_code} mono />
        <InfoRow
          label={t("profile.status")}
          value={t(`profile.status_${household.status}`)}
          badge={household.status === "active" ? "green" : "yellow"}
        />
        <InfoRow
          label={t("profile.kycTier")}
          value={t(`profile.tier_${household.kyc_tier}`)}
        />
        <InfoRow
          label={t("profile.location")}
          value={t(`profile.segment_${household.location_segment}`)}
        />
        <InfoRow
          label={t("profile.members")}
          value={String(members.length)}
        />
      </div>

      {/* KYC Status */}
      <div className="glass glass-animate p-4" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-3">
          <IconShield size={20} color={household.kyc_tier === 1 ? "var(--cat-food)" : "var(--cat-fuel)"} />
          <div className="flex-1">
            <p className="text-primary text-sm font-medium">{t("household.kyc")}</p>
            <p className="text-secondary text-xs">
              {t(`profile.kycDesc_${household.kyc_tier}`)}
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: household.kyc_tier === 1 ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
              color: household.kyc_tier === 1 ? "rgb(34,197,94)" : "rgb(234,179,8)",
            }}
          >
            {t(`profile.tier_${household.kyc_tier}`)}
          </span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: "green" | "yellow";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary text-sm">{label}</span>
      {badge ? (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            background: badge === "green" ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
            color: badge === "green" ? "rgb(34,197,94)" : "rgb(234,179,8)",
          }}
        >
          {value}
        </span>
      ) : (
        <span className={`text-primary text-sm font-medium ${mono ? "font-mono tracking-wider" : ""}`}>
          {value}
        </span>
      )}
    </div>
  );
}
