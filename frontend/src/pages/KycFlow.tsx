import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useKycStore } from "../store/useKycStore";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { useVolunteerStore, VOLUNTEER_SPECIALTIES } from "../store/useVolunteerStore";
import { useDistributorStore } from "../store/useDistributorStore";
import { registerHousehold, getHousehold, sendOTP, verifyOTP, verifyIdentity } from "../api/coupon";
import { extractErrorMessage } from "../lib/api-error";
import type { Household } from "../lib/types";
import { IconPackage, IconIdCard, IconUser, IconHouse, IconCheck, IconShield } from "../components/Icons";
import { ShamsiDatePicker } from "../components/ShamsiDatePicker";

const TOTAL_STEPS = 8;
const ACTIVE_DOT_STEPS = 7; // Steps 1-7 shown as dots (step 0 Welcome has no dots)

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

// --- Step 2: Phone Number ---
function StepPhone({
  value,
  nationalCode,
  onChange,
  onNext,
  onBack,
  onTrackId,
}: {
  value: string;
  nationalCode: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  onTrackId: (trackId: string, expiresIn: number) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (raw: string) => {
    const normalized = raw
      .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
      .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
      .replace(/\D/g, "")
      .slice(0, 11);
    onChange(normalized);
  };

  const isValid = /^09\d{9}$/.test(value);

  const sendingRef = useRef(false);
  const handleNext = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await sendOTP({ mobile: value, national_code: nationalCode });
      onTrackId(result.track_id, result.expires_in);
      onNext();
    } catch (err) {
      let message = t("kyc.otpSendFailed") || "Failed to send OTP";
      if (err instanceof Error) message = err.message;
      setError(message);
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  };

  return (
    <div className="glass glass-animate space-y-5 p-6">
      <div className="text-center">
        <div className="text-secondary"><IconShield size={40} /></div>
        <h2 className="text-primary mt-3 text-xl font-bold">
          {t("kyc.phoneTitle")}
        </h2>
        <p className="text-secondary mt-1 text-sm">
          {t("kyc.phoneDesc")}
        </p>
      </div>

      <input
        className="glass-input text-center text-lg font-mono tracking-[0.2em]"
        placeholder={t("kyc.phonePlaceholder") || "09xxxxxxxxx"}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        inputMode="numeric"
        maxLength={11}
        autoFocus
        dir="ltr"
        aria-label={t("kyc.phoneTitle")}
      />

      {value.length > 0 && value.length < 11 && (
        <p className="text-tertiary text-center text-xs">{value.length}/11</p>
      )}

      {error && (
        <div
          className="glass-subtle rounded-2xl p-3 text-center text-sm"
          style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--cat-medical)" }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button className="glass-btn flex-1" onClick={onBack} disabled={loading}>
          {t("common.back")}
        </button>
        <button
          className="glass-btn glass-btn-primary flex-1"
          onClick={handleNext}
          disabled={!isValid || loading}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t("kyc.verifying")}
            </span>
          ) : (
            t("kyc.next")
          )}
        </button>
      </div>
    </div>
  );
}

// --- Step 3: OTP Verification ---
function StepOTPVerify({
  mobile,
  nationalCode,
  trackId,
  expiresIn,
  attempts: initialAttempts,
  onNext,
  onBack,
  onResend,
  onAttempt,
}: {
  mobile: string;
  nationalCode: string;
  trackId: string;
  expiresIn: number;
  attempts: number;
  onNext: () => void;
  onBack: () => void;
  onResend: () => Promise<{ track_id: string; expires_in: number }>;
  onAttempt: (count: number) => void;
}) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(initialAttempts);
  const maxAttempts = 3;

  // Countdown timer
  const [secondsLeft, setSecondsLeft] = useState(expiresIn);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSecondsLeft(expiresIn);
  }, [expiresIn]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (secondsLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [secondsLeft]);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleChange = (raw: string) => {
    const normalized = raw
      .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
      .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
      .replace(/\D/g, "")
      .slice(0, 6);
    setOtp(normalized);
  };

  const handleSubmit = async () => {
    if (attempts >= maxAttempts) return;
    setLoading(true);
    setError(null);
    try {
      const result = await verifyOTP({
        mobile,
        national_code: nationalCode,
        otp,
        track_id: trackId,
      });
      if (result.verified) {
        onNext();
      } else {
        const newCount = attempts + 1;
        setAttempts(newCount);
        onAttempt(newCount);
        setError(t("kyc.otpWrong"));
      }
    } catch (err) {
      const newCount = attempts + 1;
      setAttempts(newCount);
      onAttempt(newCount);
      let message = t("kyc.otpWrong");
      if (err instanceof Error) message = err.message;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setOtp("");
    try {
      const result = await onResend();
      setSecondsLeft(result.expires_in);
      setAttempts(0);
    } catch (err) {
      let message = t("kyc.otpSendFailed") || "Failed to resend OTP";
      if (err instanceof Error) message = err.message;
      setError(message);
    }
  };

  const isValid = /^\d{6}$/.test(otp);
  const timerExpired = secondsLeft <= 0;
  const tooManyAttempts = attempts >= maxAttempts;

  return (
    <div className="glass glass-animate space-y-5 p-6">
      <div className="text-center">
        <div className="text-secondary"><IconShield size={40} /></div>
        <h2 className="text-primary mt-3 text-xl font-bold">
          {t("kyc.otpTitle")}
        </h2>
        <p className="text-secondary mt-1 text-sm">
          {t("kyc.otpDesc")}
        </p>
      </div>

      <input
        className="glass-input text-center text-2xl font-mono tracking-[0.5em]"
        placeholder={t("kyc.otpPlaceholder") || "------"}
        value={otp}
        onChange={(e) => handleChange(e.target.value)}
        inputMode="numeric"
        maxLength={6}
        autoFocus
        dir="ltr"
        aria-label={t("kyc.otpTitle")}
        disabled={tooManyAttempts}
      />

      {/* Timer and resend */}
      <div className="text-center">
        {!timerExpired ? (
          <p className="text-secondary text-sm">
            {formatTimer(secondsLeft)}
          </p>
        ) : (
          <button
            className="glass-btn glass-btn-sm"
            onClick={handleResend}
            disabled={!timerExpired}
          >
            {t("kyc.otpResend")}
          </button>
        )}
      </div>

      {/* Attempts display */}
      {attempts > 0 && !tooManyAttempts && (
        <p className="text-tertiary text-center text-xs">
          {attempts}/{maxAttempts}
        </p>
      )}

      {tooManyAttempts && (
        <div
          className="glass-subtle rounded-2xl p-3 text-center text-sm"
          style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--cat-medical)" }}
        >
          {t("kyc.tooManyAttempts")}
        </div>
      )}

      {error && !tooManyAttempts && (
        <div
          className="glass-subtle rounded-2xl p-3 text-center text-sm"
          style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--cat-medical)" }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button className="glass-btn flex-1" onClick={onBack} disabled={loading}>
          {t("common.back")}
        </button>
        <button
          className="glass-btn glass-btn-primary flex-1"
          onClick={handleSubmit}
          disabled={!isValid || loading || tooManyAttempts}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t("kyc.verifying")}
            </span>
          ) : (
            t("kyc.next")
          )}
        </button>
      </div>
    </div>
  );
}

// --- Step 4: Personal Info (was Step 2) ---
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
  const isValid = fullName.trim().length >= 2 && birthDate.length > 0 && gender.length > 0;

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
        <ShamsiDatePicker
          value={birthDate}
          onChange={onChangeBirthDate}
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

// --- Step 5: Address (was Step 3) ---
function StepAddress({
  address,
  onChange,
  onNext,
  onBack,
}: {
  address: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const isValid = address.trim().length >= 5;

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
        maxLength={500}
        autoFocus
        aria-label={t("household.address")}
      />

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

// --- Step 6: Volunteer (was Step 4) ---
function StepVolunteer({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { setVolunteer } = useVolunteerStore();
  const [wants, setWants] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return VOLUNTEER_SPECIALTIES;
    const q = search.toLowerCase();
    return VOLUNTEER_SPECIALTIES.filter((s) => {
      const label = t(`volunteer.specialty_${s}`).toLowerCase();
      return label.includes(q) || s.includes(q);
    });
  }, [search, t]);

  const handleNext = () => {
    const spec = wants
      ? selected === "__custom" ? `custom:${custom}` : selected
      : null;
    setVolunteer(!!wants, spec);
    onNext();
  };

  return (
    <div className="glass glass-animate space-y-5 p-6">
      <div>
        <h2 className="text-primary text-xl font-bold">{t("volunteer.title")}</h2>
        <p className="text-secondary mt-1 text-sm">{t("volunteer.description")}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { setWants(true); setSelected(null); }}
          className={`glass-btn flex-1 ${wants === true ? "glass-btn-primary" : ""}`}
        >
          {t("volunteer.yes")}
        </button>
        <button
          onClick={() => { setWants(false); setSelected(null); setSearch(""); setCustom(""); }}
          className={`glass-btn flex-1 ${wants === false ? "glass-btn-primary" : ""}`}
        >
          {t("volunteer.no")}
        </button>
      </div>

      {wants === true && (
        <div className="space-y-3">
          <p className="text-secondary text-sm font-medium">{t("volunteer.pickSpecialty")}</p>
          <input
            className="glass-input"
            placeholder={t("volunteer.searchSpecialty")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (selected === "__custom") setSelected(null); }}
          />
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s}
                onClick={() => { setSelected(s === selected ? null : s); setCustom(""); }}
                className={`glass-btn glass-btn-sm w-full text-start ${selected === s ? "glass-btn-primary" : ""}`}
              >
                {t(`volunteer.specialty_${s}`)}
              </button>
            ))}
            <button
              onClick={() => setSelected(selected === "__custom" ? null : "__custom")}
              className={`glass-btn glass-btn-sm w-full text-start ${selected === "__custom" ? "glass-btn-primary" : ""}`}
              style={selected !== "__custom" ? { borderStyle: "dashed" } : undefined}
            >
              {t("volunteer.customSpecialty")}
            </button>
          </div>
          {selected === "__custom" && (
            <input
              className="glass-input"
              placeholder={t("volunteer.customSpecialtyPlaceholder")}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
          {!selected && (
            <p className="text-tertiary text-xs">{t("volunteer.noSpecialtyHint")}</p>
          )}
        </div>
      )}

      {wants === false && (
        <div className="glass-subtle rounded-xl p-3">
          <p className="text-secondary text-sm">{t("volunteer.generalNote")}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button className="glass-btn flex-1" onClick={onBack}>{t("common.back")}</button>
        <button
          className="glass-btn glass-btn-primary flex-1"
          onClick={handleNext}
          disabled={wants === null || (wants && selected === "__custom" && !custom.trim())}
        >
          {t("kyc.next")}
        </button>
      </div>
    </div>
  );
}

// --- Step 7: Distributor + Submit (was Step 5) ---
function StepDistributorAndSubmit({
  onBack,
  onRegistered,
  nationalCode,
  fullName,
  birthDate,
  gender,
  mobile,
  address,
  kycTrackId,
}: {
  onBack: () => void;
  onRegistered: (household: Household) => void;
  nationalCode: string;
  fullName: string;
  birthDate: string;
  gender: string;
  mobile: string;
  address: string;
  kycTrackId: string;
}) {
  const { t } = useTranslation();
  const { setDistributor } = useDistributorStore();
  const [wants, setWants] = useState<boolean | null>(null);
  const [storeAddr, setStoreAddr] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    wants !== null &&
    (!wants || (storeAddr.trim().length > 0 && storeDesc.trim().length > 0));

  const submittingRef = useRef(false);
  const handleSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      setDistributor(!!wants, storeAddr, storeDesc);

      // Verify identity via Finnotech (Shahkar + NID) before registration
      if (kycTrackId) {
        const idResult = await verifyIdentity({
          national_code: nationalCode,
          full_name: fullName,
          birth_date: birthDate,
          gender,
          mobile,
          track_id: kycTrackId,
        });
        if (!idResult.shahkar_matched || !idResult.nid_verified) {
          setError(
            !idResult.shahkar_matched
              ? t("kyc.shahkarFailed")
              : t("kyc.nidFailed")
          );
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
          return;
        }
      }

      const household = await registerHousehold({
        national_code: nationalCode,
        full_name: fullName,
        birth_date: birthDate,
        gender,
        mobile,
        address,
        lat: 0,
        lng: 0,
        kyc_track_id: kycTrackId,
      });

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      onRegistered(household);
    } catch (err) {
      const message = await extractErrorMessage(err, t("kyc.registrationFailed"));
      setError(message);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="glass glass-animate space-y-5 p-6">
      <div>
        <h2 className="text-primary text-xl font-bold">{t("distributor.title")}</h2>
        <p className="text-secondary mt-1 text-sm">{t("distributor.description")}</p>
      </div>

      <div className="glass-subtle space-y-2 rounded-xl p-4">
        <p className="text-primary text-sm font-medium">{t("distributor.incentiveTitle")}</p>
        <ul className="text-secondary space-y-1.5 text-xs">
          <li>• {t("distributor.incentive1")}</li>
          <li>• {t("distributor.incentive2")}</li>
          <li>• {t("distributor.incentive3")}</li>
        </ul>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setWants(true)}
          className={`glass-btn flex-1 ${wants === true ? "glass-btn-primary" : ""}`}
        >
          {t("distributor.yes")}
        </button>
        <button
          onClick={() => { setWants(false); setStoreAddr(""); setStoreDesc(""); }}
          className={`glass-btn flex-1 ${wants === false ? "glass-btn-primary" : ""}`}
        >
          {t("distributor.no")}
        </button>
      </div>

      {wants === true && (
        <div className="space-y-3">
          <input
            className="glass-input"
            placeholder={t("distributor.storeAddress")}
            value={storeAddr}
            onChange={(e) => setStoreAddr(e.target.value)}
          />
          <textarea
            className="glass-input"
            placeholder={t("distributor.storeDescription")}
            value={storeDesc}
            onChange={(e) => setStoreDesc(e.target.value)}
            rows={3}
            style={{ resize: "none" }}
          />
          <p className="text-tertiary text-xs">{t("distributor.pendingNote")}</p>
        </div>
      )}

      {wants === false && (
        <div className="glass-subtle rounded-xl p-3">
          <p className="text-secondary text-sm">{t("distributor.skipNote")}</p>
        </div>
      )}

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
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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

// --- Success Screen ---
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
  const { t } = useTranslation();
  const { currentStep, draft, setStep, updateDraft, completeKyc } = useKycStore();
  const [registeredHousehold, setRegisteredHousehold] = useState<Household | null>(null);
  const [checking, setChecking] = useState(true);
  const [flowError, setFlowError] = useState<string | null>(null);

  const nationalCode = draft.nationalCode ?? "";
  const fullName = draft.fullName ?? "";
  const birthDate = draft.birthDate ?? "";
  const gender = draft.gender ?? "";
  const address = draft.address ?? "";
  const mobile = draft.mobile ?? "";
  const kycTrackId = draft.kycTrackId ?? "";

  // OTP expiry timer (not persisted — local state)
  const [otpExpiresIn, setOtpExpiresIn] = useState(120);

  const goNext = useCallback(() => {
    setStep(currentStep + 1);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light");
  }, [currentStep, setStep]);

  const goBack = useCallback(() => {
    setStep(Math.max(0, currentStep - 1));
  }, [currentStep, setStep]);

  // Check if user already has a household on the backend
  const loggedOut = useHouseholdStore((s) => s.loggedOut);
  useEffect(() => {
    if (loggedOut) {
      // User logged out — skip to national code + OTP login (step 1), not full onboarding
      setStep(1);
      setChecking(false);
      return;
    }

    let cancelled = false;
    getHousehold()
      .then((res) => {
        if (cancelled) return;
        // Already registered — populate stores and skip KYC
        useHouseholdStore.setState({
          household: res.household,
          members: res.members,
          loggedOut: false,
          lastFetched: Date.now(),
        });
        const head = res.members?.find((m) => m.relationship === "head");
        completeKyc({
          nationalCode: head?.national_code ?? "",
          mobile: res.household.phone_number ?? "",
          fullName: head?.full_name ?? "",
          birthDate: head?.birth_date ?? "",
          gender: head?.gender ?? "",
          address: res.household.address ?? "",
          lat: res.household.lat ?? 0,
          lng: res.household.lng ?? 0,
          kycTier: res.household.kyc_tier,
          kycTrackId: "",
          otpVerified: true,
          identityVerified: true,
          otpAttempts: 0,
          otpSendCount: 0,
          completedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Not registered — show KYC flow
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedOut]);

  const handleRegistered = async (household: Household) => {
    // Fetch full household + members from backend to populate store correctly
    try {
      const res = await getHousehold();
      useHouseholdStore.setState({
        household: res.household,
        members: res.members,
        loggedOut: false,
        lastFetched: Date.now(),
      });
    } catch {
      // Fallback: use the returned household with head member from draft
      useHouseholdStore.setState({
        household,
        members: [{
          id: 0, household_id: household.id,
          national_code: nationalCode, full_name: fullName,
          birth_date: birthDate, gender, relationship: "head",
          age_group: "", special_flags: [], kyc_verified: true,
          created_at: new Date().toISOString(),
        }],
        loggedOut: false,
        lastFetched: Date.now(),
      });
    }
    setRegisteredHousehold(household);
  };

  const handleEnterApp = () => {
    completeKyc({
      nationalCode,
      mobile,
      fullName,
      birthDate,
      gender,
      address,
      lat: 0,
      lng: 0,
      kycTier: registeredHousehold?.kyc_tier ?? 1,
      kycTrackId,
      otpVerified: true,
      identityVerified: true,
      otpAttempts: 0,
      otpSendCount: 0,
      completedAt: new Date().toISOString(),
    });
  };

  // Show loading while checking backend
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-white/20 border-t-white/80" />
      </div>
    );
  }

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
          <StepPhone
            value={mobile}
            nationalCode={nationalCode}
            onChange={(v) => updateDraft({ mobile: v })}
            onNext={goNext}
            onBack={goBack}
            onTrackId={(trackId, expiresIn) => {
              updateDraft({ kycTrackId: trackId });
              setOtpExpiresIn(expiresIn);
            }}
          />
        );
      case 3:
        return (
          <StepOTPVerify
            mobile={mobile}
            nationalCode={nationalCode}
            trackId={kycTrackId}
            expiresIn={otpExpiresIn}
            attempts={Number(draft.otpAttempts) || 0}
            onAttempt={(count) => updateDraft({ otpAttempts: count })}
            onNext={async () => {
              updateDraft({ otpVerified: true });
              // If re-login (not fresh registration), try to fetch existing household
              if (loggedOut) {
                try {
                  const res = await getHousehold();
                  const head = res.members?.find((m) => m.relationship === "head");

                  // Verify entered national code matches the household on record
                  if (head && head.national_code !== nationalCode) {
                    setFlowError(t("kyc.nationalCodeMismatch") || "National code does not match this account");
                    return;
                  }

                  useHouseholdStore.setState({
                    household: res.household,
                    members: res.members,
                    loggedOut: false,
                    lastFetched: Date.now(),
                  });
                  completeKyc({
                    nationalCode: head?.national_code ?? nationalCode,
                    mobile,
                    fullName: head?.full_name ?? "",
                    birthDate: head?.birth_date ?? "",
                    gender: head?.gender ?? "",
                    address: res.household.address ?? "",
                    lat: res.household.lat ?? 0,
                    lng: res.household.lng ?? 0,
                    kycTier: res.household.kyc_tier,
                    kycTrackId,
                    otpVerified: true,
                    identityVerified: true,
                    completedAt: new Date().toISOString(),
                    otpAttempts: 0,
                    otpSendCount: 0,
                  });
                  return; // Skip to main app — no need for personal info/address/etc
                } catch {
                  // No existing household — continue with full registration
                }
              }
              goNext();
            }}
            onBack={goBack}
            onResend={async () => {
              const result = await sendOTP({ mobile, national_code: nationalCode });
              updateDraft({ kycTrackId: result.track_id });
              return result;
            }}
          />
        );
      case 4:
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
      case 5:
        return (
          <StepAddress
            address={address}
            onChange={(v) => updateDraft({ address: v })}
            onNext={goNext}
            onBack={goBack}
          />
        );
      case 6:
        return (
          <StepVolunteer
            onNext={goNext}
            onBack={goBack}
          />
        );
      case 7:
        return (
          <StepDistributorAndSubmit
            onBack={goBack}
            onRegistered={handleRegistered}
            nationalCode={nationalCode}
            fullName={fullName}
            birthDate={birthDate}
            gender={gender}
            mobile={mobile}
            address={address}
            kycTrackId={kycTrackId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      {currentStep > 0 && currentStep < TOTAL_STEPS && (
        <div className="mb-6 w-full max-w-sm">
          <StepDots current={currentStep - 1} total={ACTIVE_DOT_STEPS} />
        </div>
      )}
      {flowError && (
        <div className="glass-subtle mb-4 w-full max-w-sm rounded-2xl p-3 text-center text-sm" style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "var(--cat-medical)" }}>
          {flowError}
        </div>
      )}
      <div className="w-full max-w-sm">{renderStep()}</div>
    </div>
  );
}
