import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { MemberCard } from "../components/MemberCard";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";

type FormMode = "idle" | "register" | "addMember";

export function HouseholdTab() {
  const { t } = useTranslation();
  const {
    household,
    members,
    loading,
    error,
    fetchHousehold,
    register,
    addMember,
  } = useHouseholdStore();

  const [formMode, setFormMode] = useState<FormMode>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const [nationalCode, setNationalCode] = useState("");
  const [address, setAddress] = useState("");

  const [mNationalCode, setMNationalCode] = useState("");
  const [mFullName, setMFullName] = useState("");
  const [mBirthDate, setMBirthDate] = useState("");
  const [mGender, setMGender] = useState("male");
  const [mRelationship, setMRelationship] = useState("spouse");
  const [mFlags, setMFlags] = useState<string[]>([]);

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  const handleRegister = async () => {
    if (!nationalCode || !address) return;
    setFormError(null);
    try {
      await register(nationalCode, address, 0, 0);
      setFormMode("idle");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Registration failed");
    }
  };

  const handleAddMember = async () => {
    if (!mNationalCode || !mFullName || !mBirthDate) return;
    setFormError(null);
    try {
      await addMember({
        national_code: mNationalCode,
        full_name: mFullName,
        birth_date: mBirthDate,
        gender: mGender,
        relationship: mRelationship,
        special_flags: mFlags.length > 0 ? mFlags : undefined,
      });
      setFormMode("idle");
      setMNationalCode("");
      setMFullName("");
      setMBirthDate("");
      setMFlags([]);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to add member");
    }
  };

  const toggleFlag = (flag: string) => {
    setMFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
  };

  if (loading && !household) return <Loading />;
  if (error && !household) return <ErrorState message={error} onRetry={fetchHousehold} />;

  // Registration form
  if (!household) {
    return (
      <div className="space-y-4">
        <div className="glass glass-animate space-y-4 p-5">
          <h2 className="text-primary font-semibold">{t("household.register")}</h2>
          <input
            className="glass-input"
            placeholder={t("household.nationalCode")}
            value={nationalCode}
            onChange={(e) => setNationalCode(e.target.value)}
            inputMode="numeric"
            maxLength={10}
            aria-label={t("household.nationalCode")}
          />
          <input
            className="glass-input"
            placeholder={t("household.address")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-label={t("household.address")}
          />
          {formError && (
            <p className="text-sm" style={{ color: "var(--cat-medical)" }}>{formError}</p>
          )}
          <button
            className="glass-btn glass-btn-primary glass-btn-lg"
            onClick={handleRegister}
            disabled={!nationalCode || !address || loading}
          >
            {loading ? "..." : t("household.submitRegister")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Household Code */}
      <div className="glass glass-animate flex items-center justify-between p-4">
        <span className="text-secondary text-sm">{t("household.householdCode")}</span>
        <span className="text-primary font-mono text-sm font-bold tracking-wider">
          {household.household_code}
        </span>
      </div>

      {/* Members */}
      <div className="glass glass-animate space-y-3 p-4" style={{ animationDelay: "50ms" }}>
        <h2 className="text-primary font-semibold">
          {t("household.members")} ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      </div>

      {/* Add Member */}
      {formMode === "addMember" ? (
        <div className="glass glass-animate space-y-4 p-5" style={{ animationDelay: "100ms" }}>
          <h2 className="text-primary font-semibold">{t("household.addMember")}</h2>
          <input
            className="glass-input"
            placeholder={t("household.nationalCode")}
            value={mNationalCode}
            onChange={(e) => setMNationalCode(e.target.value)}
            inputMode="numeric"
            maxLength={10}
            aria-label={t("household.nationalCode")}
          />
          <input
            className="glass-input"
            placeholder={t("household.fullName")}
            value={mFullName}
            onChange={(e) => setMFullName(e.target.value)}
            aria-label={t("household.fullName")}
          />
          <input
            type="date"
            className="glass-input"
            value={mBirthDate}
            onChange={(e) => setMBirthDate(e.target.value)}
            aria-label={t("household.birthDate")}
          />

          {/* Gender */}
          <div className="flex gap-2">
            {(["male", "female", "other"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setMGender(g)}
                className={`glass-btn glass-btn-sm flex-1 ${
                  mGender === g ? "glass-btn-primary" : ""
                }`}
              >
                {t(`household.${g}`)}
              </button>
            ))}
          </div>

          {/* Relationship */}
          <div className="flex flex-wrap gap-2">
            {(["spouse", "child", "parent"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setMRelationship(r)}
                className={`glass-btn glass-btn-sm ${
                  mRelationship === r ? "glass-btn-primary" : ""
                }`}
              >
                {t(`household.${r}`)}
              </button>
            ))}
          </div>

          {/* Special Flags */}
          <div>
            <p className="text-secondary mb-2 text-xs">{t("household.specialFlags")}</p>
            <div className="flex flex-wrap gap-2">
              {(["pregnant", "chronic", "disability", "newborn", "sanitary"] as const).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => toggleFlag(f)}
                    className={`glass-btn glass-btn-sm ${
                      mFlags.includes(f)
                        ? "glass-btn-primary"
                        : ""
                    }`}
                    style={
                      mFlags.includes(f)
                        ? { background: "rgba(168, 85, 247, 0.5)", borderColor: "rgba(168, 85, 247, 0.4)" }
                        : undefined
                    }
                  >
                    {t(`household.${f}`)}
                  </button>
                )
              )}
            </div>
          </div>

          {formError && (
            <p className="text-sm" style={{ color: "var(--cat-medical)" }}>{formError}</p>
          )}

          <div className="flex gap-3">
            <button
              className="glass-btn flex-1"
              onClick={() => setFormMode("idle")}
            >
              {t("common.cancel")}
            </button>
            <button
              className="glass-btn glass-btn-primary flex-1"
              onClick={handleAddMember}
              disabled={!mNationalCode || !mFullName || !mBirthDate || loading}
            >
              {loading ? "..." : t("household.submitMember")}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="glass-btn glass-btn-lg glass-animate"
          onClick={() => setFormMode("addMember")}
          style={{ animationDelay: "150ms" }}
        >
          {t("household.addMember")}
        </button>
      )}
    </div>
  );
}

// Keep backward compat — old route still works
export function HouseholdPage() {
  return (
    <div className="p-4 space-y-4">
      <HouseholdTab />
    </div>
  );
}
