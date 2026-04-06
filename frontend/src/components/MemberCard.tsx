import { useTranslation } from "react-i18next";
import type { HouseholdMember } from "../lib/types";
import { GENDER_ICONS, IconShield } from "./Icons";

interface MemberCardProps {
  member: HouseholdMember;
}

export function MemberCard({ member }: MemberCardProps) {
  const { t } = useTranslation();
  const GenderIcon = GENDER_ICONS[member.gender] ?? GENDER_ICONS["other"]!;

  return (
    <div className="glass-subtle flex items-center gap-3 rounded-2xl p-3">
      <div className="text-secondary">
        <GenderIcon size={24} />
      </div>
      <div className="flex-1">
        <div className="text-primary text-sm font-medium">
          {member.full_name}
        </div>
        <div className="text-tertiary text-xs">
          {t(`household.${member.relationship}`, {
            defaultValue: member.relationship,
          })}
        </div>
      </div>
      {member.kyc_verified && (
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            color: "var(--cat-food)",
            border: "1px solid rgba(34, 197, 94, 0.25)",
          }}
        >
          <IconShield size={12} />
          {t("household.kycVerified")}
        </span>
      )}
    </div>
  );
}
