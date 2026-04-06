import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useKycStore } from "../store/useKycStore";
import { registerHousehold, getHousehold } from "../api/coupon";
import type { Household } from "../lib/types";
import { IconPackage, IconIdCard, IconUser, IconHouse, IconCheck } from "../components/Icons";

const TOTAL_STEPS = 4;

// --- Step Indicator ---
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-500"
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            background:
              i === current
                ? "rgba(59, 130, 246, 0.8)"
                : i < current
                  ? "rgba(59, 130, 246, 0.4)"
                  : "var(--lg-bg-prominent)",
            border: "1px solid var(--lg-border-subtle)",
          }}
        />
      ))}
    </div>
  );
}

// --- Step 0: Welcome ---
function StepWelcome({ onNext }: { onNext: () => void }) {
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language === "fa" ? "en" : "fa";
    i18n.changeLanguage(next);
    document.documentElement.dir = next === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = next;
  };

  return (
    <div className="glass glass-prominent glass-animate glass-shimmer flex flex-col items-center gap-6 p-8 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
        style={{
          background: "rgba(59, 130, 246, 0.15)",
          boxShadow: "0 0 40px rgba(59, 130, 246, 0.15)",
        }}
      >
        <IconPackage size={40} />
      </div>

      <div>
        <h1 className="text-primary text-2xl font-bold">
          {t("app.title")}
        </h1>
        <p className="text-secondary mt-2 text-sm leading-relaxed">
          {t("kyc.welcomeDesc")}
        </p>
      </div>

      <button className="glass-btn glass-btn-primary glass-btn-lg" onClick={onNext}>
        {t("kyc.getStarted")}
      </button>

      <button
        onClick={toggleLang}
        className="glass-btn glass-btn-sm"
        aria-label="Toggle language"
      >
        {i18n.language === "fa" ? "English" : "\u0641\u0627\u0631\u0633\u06CC"}
      </button>
    </div>
  );
}

// --- Step 1: National Code ---
function StepNationalCode({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const isValid = /^\d{10}$/.test(value);

  const handleChange = (raw: string) => {
    const normalized = raw
      .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
      .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
      .replace(/\D/g, "")
      .slice(0, 10);
    onChange(normalized);
  };

  return (
    <div className="glass glass-animate space-y-5 p-6">
      <div className="text-center">
        <div className="text-secondary"><IconIdCard size={40} /></div>
        <h2 className="text-primary mt-3 text-xl font-bold">
          {t("kyc.nationalCodeTitle")}
        </h2>
        <p className="text-secondary mt-1 text-sm">
          {t("kyc.nationalCodeDesc")}
        </p>
      </div>

      <input
        className="glass-input text-center text-lg font-mono tracking-[0.3em]"
        placeholder="_ _ _ _ _ _ _ _ _ _"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        inputMode="numeric"
        maxLength={10}
        autoFocus
        dir="ltr"
        aria-label={t("household.nationalCode")}
      />

      {value.length > 0 && value.length < 10 && (
        <p className="text-tertiary text-center text-xs">{value.length}/10</p>
      )}

      <div className="flex gap-3">
        <button className="glass-btn flex-1" onClick={onBack}>
          {t("common.back")}
        </button>
        <button
          className="glass-btn glass-btn-primary flex-1"
          onClick={onNext}
          disabled={!isValid}
        >
          {t("kyc.next")}
        </button>
      </div>
    </div>
  );
}

// --- Step 2: Personal Info ---
function StepPersonalInfo({
  fullName,
  birthDate,
  gender,
  onChangeFullName,
  onChangeBirthDate,
  onChangeGender,
  onNext,
  onBack,
}: {
  fullName: string;
  birthDate: string;
  gender: string;
  onChangeFullName: (v: string) => void;
  onChangeBirthDate: (v: string) => void;
  onChangeGender: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const isValid = fullName.trim().length >= 2 && birthDate.length > 0;

  return (
    <div className="glass glass-animate space-y-5 p-6">
      <div className="text-center">
        <div className="text-secondary"><IconUser size={40} /></div>
        <h2 className="text-primary mt-3 text-xl font-bold">
          {t("kyc.personalInfoTitle")}
        </h2>
        <p className="text-secondary mt-1 text-sm">
          {t("kyc.personalInfoDesc")}
        </p>
      </div>

      <div className="space-y-3">
        <input
          className="glass-input"
          placeholder={t("household.fullName")}
          value={fullName}
          onChange={(e) => onChangeFullName(e.target.value)}
          autoFocus
          aria-label={t("household.fullName")}
        />
        <input
          type="date"
          className="glass-input"
          value={birthDate}
          onChange={(e) => onChangeBirthDate(e.target.value)}
          aria-label={t("household.birthDate")}
        />
        <div>
          <p className="text-secondary mb-2 text-xs">{t("household.gender")}</p>
          <div className="flex gap-2">
            {(["male", "female", "other"] as const).map((g) => (
              <button
                key={g}
                onClick={() => onChangeGender(g)}
                className={`glass-btn glass-btn-sm flex-1 ${
                  gender === g ? "glass-btn-primary" : ""
                }`}
              >
                {t(`household.${g}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="glass-btn flex-1" onClick={onBack}>
          {t("common.back")}
        </button>
        <button
          className="glass-btn glass-btn-primary flex-1"
          onClick={onNext}
          disabled={!isValid}
        >
          {t("kyc.next")}
        </button>
      </div>
    </div>
  );
}

// --- Step 3: Address + Submit (hits real backend) ---
function StepAddressAndSubmit({
  address,
  onChange,
  onBack,
  onRegistered,
}: {
  address: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onRegistered: (household: Household) => void;
}) {
  const { t } = useTranslation();
  const draft = useKycStore((s) => s.draft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = address.trim().length >= 5;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      // 1. Register household — backend validates Telegram initData (real auth)
      const household = await registerHousehold({
        national_code: draft.nationalCode ?? "",
        address,
        lat: 0,
        lng: 0,
      });

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      onRegistered(household);
    } catch (err) {
      // Parse ky error body if possible
      let message = t("kyc.registrationFailed");
      if (err && typeof err === "object" && "response" in err) {
        try {
          const body = await (err as { response: Response }).response.json();
          if (body?.error?.message) {
            message = body.error.message;
          }
        } catch {
          // body not parseable
        }
      } else if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass glass-animate space-y-5 p-6">
      <div className="text-center">
        <div className="text-secondary"><IconHouse size={40} /></div>
        <h2 className="text-primary mt-3 text-xl font-bold">
          {t("kyc.addressTitle")}
        </h2>
        <p className="text-secondary mt-1 text-sm">
          {t("kyc.addressDesc")}
        </p>
      </div>

      <textarea
        className="glass-input min-h-[100px] resize-none"
        placeholder={t("household.address")}
        value={address}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        aria-label={t("household.address")}
      />

      {error && (
        <div
          className="glass-subtle rounded-2xl p-3 text-center text-sm"
          style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--cat-medical)" }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button className="glass-btn flex-1" onClick={onBack} disabled={submitting}>
          {t("common.back")}
        </button>
        <button
          className="glass-btn glass-btn-primary flex-1"
          onClick={handleSubmit}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
              />
              {t("kyc.registering")}
            </span>
          ) : (
            t("household.submitRegister")
          )}
        </button>
      </div>
    </div>
  );
}

// --- Success Screen (shown after backend confirms registration) ---
function StepSuccess({
  household,
  onEnter,
}: {
  household: Household;
  onEnter: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="glass glass-prominent glass-animate flex flex-col items-center gap-6 p-8 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
        style={{
          background: "rgba(34, 197, 94, 0.15)",
          boxShadow: "0 0 40px rgba(34, 197, 94, 0.2)",
        }}
      >
        <IconCheck size={40} />
      </div>

      <div>
        <h2 className="text-primary text-xl font-bold">
          {t("kyc.successTitle")}
        </h2>
        <p className="text-secondary mt-2 text-sm">
          {t("kyc.successDesc")}
        </p>
      </div>

      <div className="glass-subtle w-full rounded-2xl p-3">
        <span className="text-tertiary text-xs">{t("household.householdCode")}</span>
        <div className="text-primary mt-0.5 font-mono text-sm font-bold tracking-wider">
          {household.household_code}
        </div>
      </div>

      <button className="glass-btn glass-btn-primary glass-btn-lg" onClick={onEnter}>
        {t("kyc.enterApp")}
      </button>
    </div>
  );
}

// --- Main KYC Flow ---
export function KycFlow() {
  const { currentStep, draft, setStep, updateDraft, completeKyc } = useKycStore();
  const [registeredHousehold, setRegisteredHousehold] = useState<Household | null>(null);

  const nationalCode = draft.nationalCode ?? "";
  const fullName = draft.fullName ?? "";
  const birthDate = draft.birthDate ?? "";
  const gender = draft.gender ?? "male";
  const address = draft.address ?? "";

  const goNext = useCallback(() => {
    setStep(currentStep + 1);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
  }, [currentStep, setStep]);

  const goBack = useCallback(() => {
    setStep(Math.max(0, currentStep - 1));
  }, [currentStep, setStep]);

  // Check if user already has a household on the backend (e.g. cleared local storage)
  useEffect(() => {
    getHousehold()
      .then((res) => {
        // Already registered on backend — skip KYC
        completeKyc({
          nationalCode: "",
          fullName: "",
          birthDate: "",
          gender: "",
          address: "",
          lat: 0,
          lng: 0,
          kycTier: res.household.kyc_tier,
          completedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Not registered yet — continue KYC flow
      });
  }, [completeKyc]);

  const handleRegistered = (household: Household) => {
    setRegisteredHousehold(household);
  };

  const handleEnterApp = () => {
    completeKyc({
      nationalCode,
      fullName,
      birthDate,
      gender,
      address,
      lat: 0,
      lng: 0,
      kycTier: registeredHousehold?.kyc_tier ?? 1,
      completedAt: new Date().toISOString(),
    });
  };

  // Show success screen after backend confirmed registration
  if (registeredHousehold) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <StepSuccess
            household={registeredHousehold}
            onEnter={handleEnterApp}
          />
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepWelcome onNext={goNext} />;
      case 1:
        return (
          <StepNationalCode
            value={nationalCode}
            onChange={(v) => updateDraft({ nationalCode: v })}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case 2:
        return (
          <StepPersonalInfo
            fullName={fullName}
            birthDate={birthDate}
            gender={gender}
            onChangeFullName={(v) => updateDraft({ fullName: v })}
            onChangeBirthDate={(v) => updateDraft({ birthDate: v })}
            onChangeGender={(v) => updateDraft({ gender: v })}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case 3:
        return (
          <StepAddressAndSubmit
            address={address}
            onChange={(v) => updateDraft({ address: v })}
            onBack={goBack}
            onRegistered={handleRegistered}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      {currentStep > 0 && currentStep < 4 && (
        <div className="mb-6 w-full max-w-sm">
          <StepDots current={currentStep} total={TOTAL_STEPS} />
        </div>
      )}
      <div className="w-full max-w-sm">{renderStep()}</div>
    </div>
  );
}
