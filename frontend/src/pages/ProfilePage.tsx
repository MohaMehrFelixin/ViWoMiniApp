import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useHouseholdStore } from "../store/useHouseholdStore";
import { useBalanceStore } from "../store/useBalanceStore";
import { useVolunteerStore, VOLUNTEER_SPECIALTIES } from "../store/useVolunteerStore";
import { useDistributorStore } from "../store/useDistributorStore";
import { useKycStore } from "../store/useKycStore";
import { useProviderStore } from "../store/useProviderStore";
import { useProductOfferingStore } from "../store/useProductOfferingStore";
import { HouseholdTab } from "./HouseholdPage";
import { IconUser, IconFamily, IconHistory, IconShield, IconHeadset } from "../components/Icons";
import { RedemptionItem } from "../components/RedemptionItem";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import type { CouponRedemption } from "../lib/types";
import { getRedemptionHistory, disputeRedemption } from "../api/coupon";
import { formatDate } from "../lib/utils";

// ======================== PROFILE MENU (main page) ========================

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  // Wire Telegram's native back button
  useEffect(() => {
    const tgBack = window.Telegram?.WebApp?.BackButton;
    if (tgBack) {
      tgBack.show();
      tgBack.onClick(onClick);
      return () => {
        tgBack.offClick(onClick);
        tgBack.hide();
      };
    }
  }, [onClick]);

  return (
    <button onClick={onClick} className="text-secondary flex items-center gap-1 text-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {t("common.back")}
    </button>
  );
}

const MENU_ITEMS = [
  { path: "/profile/info", labelKey: "profile.info", Icon: IconUser, color: "var(--cat-water)" },
  { path: "/profile/household", labelKey: "profile.household", Icon: IconFamily, color: "var(--cat-food)" },
  { path: "/profile/history", labelKey: "profile.history", Icon: IconHistory, color: "var(--cat-fuel)" },
  { path: "/profile/collaboration", labelKey: "profile.collaboration", Icon: IconShield, color: "var(--cat-hygiene)" },
  { path: "/profile/support", labelKey: "profile.support", Icon: IconHeadset, color: "var(--cat-medical)" },
] as const;

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { household, members } = useHouseholdStore();
  const kycData = useKycStore((s) => s.data);
  const headMember = members.find((m) => m.relationship === "head");

  const displayName = headMember?.full_name || kycData?.fullName || t("profile.title");

  return (
    <div className="space-y-4 p-4">
      {/* Header with avatar */}
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
              {displayName}
            </p>
            {household && (
              <p className="text-tertiary font-mono text-xs">{household.household_code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div className="glass glass-animate overflow-hidden" style={{ animationDelay: "50ms" }}>
        {MENU_ITEMS.map((item, i) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex w-full items-center gap-4 px-5 py-4 text-start active:opacity-70"
            style={{
              borderBottom: i < MENU_ITEMS.length - 1 ? "0.5px solid var(--separator)" : "none",
            }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: `color-mix(in srgb, ${item.color} 15%, transparent)` }}
            >
              <item.Icon size={18} color={item.color} />
            </div>
            <span className="text-primary flex-1 text-sm font-medium">{t(item.labelKey)}</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: i18n.language === "fa" ? "scaleX(-1)" : undefined }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      {/* Logout */}
      <LogoutButton />
    </div>
  );
}

// ======================== SUBPAGE WRAPPERS ========================

export function ProfileInfoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-4 p-4">
      <BackButton onClick={() => navigate("/profile")} />
      <h1 className="text-primary text-xl font-bold">{t("profile.info")}</h1>
      <ProfileInfoContent />
    </div>
  );
}

export function ProfileHouseholdPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-4 p-4">
      <BackButton onClick={() => navigate("/profile")} />
      <h1 className="text-primary text-xl font-bold">{t("profile.household")}</h1>
      <HouseholdTab />
    </div>
  );
}

export function ProfileHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-4 p-4">
      <BackButton onClick={() => navigate("/profile")} />
      <h1 className="text-primary text-xl font-bold">{t("profile.history")}</h1>
      <HistoryContent />
    </div>
  );
}

export function ProfileCollaborationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-4 p-4">
      <BackButton onClick={() => navigate("/profile")} />
      <h1 className="text-primary text-xl font-bold">{t("profile.collaboration")}</h1>
      <CollaborationContent />
    </div>
  );
}

// ======================== INFO CONTENT ========================

function ProfileInfoContent() {
  const { t, i18n } = useTranslation();
  const { household, members } = useHouseholdStore();
  const kycData = useKycStore((s) => s.data);

  if (!household) {
    return (
      <div className="glass glass-animate p-6 text-center">
        <IconUser size={48} className="text-secondary mx-auto mb-3 opacity-40" />
        <p className="text-secondary text-sm">{t("home.registerFirst")}</p>
      </div>
    );
  }

  const headMember = members.find((m) => m.relationship === "head");

  // Primary: backend data (headMember). Fallback: KYC store (localStorage).
  const displayName = headMember?.full_name || kycData?.fullName || t("household.head");
  const displayBirthDate = headMember?.birth_date || kycData?.birthDate || "";
  const displayGender = headMember?.gender || kycData?.gender || "";
  const displayPhone = household.phone_number || kycData?.mobile || "";

  return (
    <div className="space-y-3">
      <div className="glass glass-animate p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(59, 130, 246, 0.15)" }}>
            <IconUser size={28} color="var(--cat-water)" />
          </div>
          <div className="flex-1">
            <p className="text-primary text-base font-semibold">{displayName}</p>
            <p className="text-secondary text-xs">
              {headMember?.national_code ? `${t("household.nationalCode")}: ${headMember.national_code}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="glass glass-animate space-y-3 p-4" style={{ animationDelay: "50ms" }}>
        <InfoRow label={t("household.householdCode")} value={household.household_code} mono />
        {displayPhone && <InfoRow label={t("kyc.phoneTitle")} value={displayPhone} mono />}
        {displayBirthDate && <InfoRow label={t("household.birthDate")} value={formatDate(displayBirthDate, i18n.language)} />}
        {displayGender && <InfoRow label={t("household.gender")} value={t(`household.${displayGender}`)} />}
        {household.address && <InfoRow label={t("household.address")} value={household.address} />}
        <InfoRow label={t("profile.status")} value={t(`profile.status_${household.status}`)} badge={household.status === "active" ? "green" : "yellow"} />
        <InfoRow label={t("profile.kycTier")} value={t(`profile.tier_${household.kyc_tier}`)} />
        <InfoRow label={t("profile.location")} value={t(`profile.segment_${household.location_segment}`)} />
        <InfoRow label={t("profile.members")} value={String(members.length)} />
      </div>

      <div className="glass glass-animate p-4" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-3">
          <IconShield size={20} color={household.kyc_tier === 1 ? "var(--cat-food)" : "var(--cat-fuel)"} />
          <div className="flex-1">
            <p className="text-primary text-sm font-medium">{t("household.kyc")}</p>
            <p className="text-secondary text-xs">{t(`profile.kycDesc_${household.kyc_tier}`)}</p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{
            background: household.kyc_tier === 1 ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
            color: household.kyc_tier === 1 ? "rgb(34,197,94)" : "rgb(234,179,8)",
          }}>{t(`profile.tier_${household.kyc_tier}`)}</span>
        </div>
      </div>
    </div>
  );
}

// ======================== HISTORY CONTENT ========================

function HistoryContent() {
  const { t } = useTranslation();
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const cursorRef = useRef<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeId, setDisputeId] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getRedemptionHistory(isLoadMore ? cursorRef.current : undefined);
      if (isLoadMore) setRedemptions((prev) => [...prev, ...res.redemptions]);
      else setRedemptions(res.redemptions);
      cursorRef.current = res.next_cursor;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleDispute = async () => {
    if (!disputeId || disputeReason.length < 10) return;
    setDisputeLoading(true);
    setDisputeError(null);
    try {
      await disputeRedemption(disputeId, disputeReason);
      setRedemptions((prev) => prev.map((r) => (r.id === disputeId ? { ...r, status: "disputed" } : r)));
      setDisputeId(null);
      setDisputeReason("");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    } catch {
      setDisputeError("Failed to submit dispute");
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
    }
    finally { setDisputeLoading(false); }
  };

  if (loading) return <Loading />;
  if (error && redemptions.length === 0) return <ErrorState message={error} onRetry={() => fetchHistory()} />;
  if (redemptions.length === 0) return <EmptyState icon={<IconHistory size={48} />} title={t("history.noHistory")} />;

  return (
    <div className="space-y-3">
      <div className="glass glass-animate space-y-2 p-3">
        {redemptions.map((r) => (
          <RedemptionItem key={r.id} redemption={r} onDispute={(id) => setDisputeId(id)} />
        ))}
      </div>

      {cursorRef.current && (
        <button className="glass-btn glass-btn-lg" onClick={() => fetchHistory(true)} disabled={loadingMore}>
          {loadingMore ? "..." : t("history.loadMore")}
        </button>
      )}

      {disputeError && (
        <div className="glass-subtle rounded-2xl p-3 text-center text-sm" style={{ color: "var(--cat-medical)" }}>
          {disputeError}
        </div>
      )}

      {disputeId !== null && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => { setDisputeId(null); setDisputeReason(""); }} aria-hidden="true" />
          <div className="glass glass-prominent glass-animate fixed inset-x-4 bottom-24 z-50 space-y-4 p-5" role="dialog" aria-modal="true" aria-label={t("history.submitDispute")} onKeyDown={(e) => { if (e.key === "Escape") { setDisputeId(null); setDisputeReason(""); } }}>
            <h3 className="text-primary font-bold">{t("history.submitDispute")}</h3>
            <input className="glass-input" placeholder={t("history.disputeReason")} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button className="glass-btn flex-1" onClick={() => { setDisputeId(null); setDisputeReason(""); }}>{t("common.cancel")}</button>
              <button className="glass-btn glass-btn-primary flex-1" onClick={handleDispute} disabled={disputeReason.length < 10 || disputeLoading}>
                {disputeLoading ? "..." : t("history.submitDispute")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ======================== COLLABORATION CONTENT ========================

function CollaborationContent() {
  return (
    <div className="space-y-3">
      <VolunteerSection />
      <DistributorSection />
    </div>
  );
}

// ======================== LOGOUT ========================

function LogoutButton() {
  const { t } = useTranslation();
  const clearHousehold = useHouseholdStore((s) => s.clear);
  const clearBalances = useBalanceStore((s) => s.clear);
  const clearVolunteer = useVolunteerStore((s) => s.clear);
  const clearDistributor = useDistributorStore((s) => s.clear);
  const clearProvider = useProviderStore((s) => s.clear);
  const clearOfferings = useProductOfferingStore((s) => s.clear);
  const resetKyc = useKycStore((s) => s.reset);
  const [confirming, setConfirming] = useState(false);

  const handleLogout = () => {
    // Clear local session — backend data stays intact
    // User re-authenticates with national code + OTP to get back in
    clearHousehold();   // clears local cache, sets loggedOut=true
    clearBalances();
    clearVolunteer();   // clear localStorage-only data
    clearDistributor(); // clear localStorage-only data
    clearProvider();    // clear provider profile/stats
    clearOfferings();   // clear product offerings
    resetKyc();         // sets completed=false → shows KYC login flow
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("warning");
  };

  if (confirming) {
    return (
      <div className="glass glass-animate space-y-3 p-4">
        <p className="text-primary text-sm font-medium text-center">{t("profile.logoutConfirm")}</p>
        <div className="flex gap-3">
          <button className="glass-btn flex-1" onClick={() => setConfirming(false)}>{t("common.cancel")}</button>
          <button className="glass-btn flex-1" style={{ background: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.3)", color: "rgb(239,68,68)" }} onClick={handleLogout}>{t("profile.logout")}</button>
        </div>
      </div>
    );
  }

  return (
    <button className="glass-btn glass-btn-lg glass-animate w-full" style={{ color: "rgb(239,68,68)" }} onClick={() => { setConfirming(true); window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("warning"); }}>
      {t("profile.logout")}
    </button>
  );
}

// ======================== VOLUNTEER SECTION ========================

function VolunteerSection() {
  const { t } = useTranslation();
  const { isVolunteer, specialty, setVolunteer } = useVolunteerStore();
  const [editing, setEditing] = useState(false);
  const [editWants, setEditWants] = useState(isVolunteer);
  const [editSpecialty, setEditSpecialty] = useState<string | null>(specialty);
  const [search, setSearch] = useState("");
  const [editCustom, setEditCustom] = useState(specialty?.startsWith("custom:") ? specialty.slice(7) : "");

  const filtered = useMemo(() => {
    if (!search.trim()) return VOLUNTEER_SPECIALTIES;
    const q = search.toLowerCase();
    return VOLUNTEER_SPECIALTIES.filter((s) => {
      const label = t(`volunteer.specialty_${s}`).toLowerCase();
      return label.includes(q) || s.includes(q);
    });
  }, [search, t]);

  const handleSave = () => {
    const spec = editSpecialty === "__custom" ? `custom:${editCustom}` : editSpecialty;
    setVolunteer(editWants, editWants ? spec : null);
    setEditing(false);
    setSearch("");
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
  };

  const startEdit = () => {
    setEditWants(isVolunteer);
    if (specialty?.startsWith("custom:")) { setEditSpecialty("__custom"); setEditCustom(specialty.slice(7)); }
    else { setEditSpecialty(specialty); setEditCustom(""); }
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="glass glass-animate space-y-4 p-5">
        <h3 className="text-primary font-semibold">{t("volunteer.title")}</h3>
        <p className="text-secondary text-sm">{t("volunteer.description")}</p>
        <div className="flex gap-2">
          <button onClick={() => { setEditWants(true); setEditSpecialty(null); }} className={`glass-btn flex-1 ${editWants ? "glass-btn-primary" : ""}`}>{t("volunteer.yes")}</button>
          <button onClick={() => { setEditWants(false); setEditSpecialty(null); setSearch(""); }} className={`glass-btn flex-1 ${!editWants ? "glass-btn-primary" : ""}`}>{t("volunteer.no")}</button>
        </div>
        {editWants && (
          <div className="space-y-3">
            <p className="text-secondary text-sm font-medium">{t("volunteer.pickSpecialty")}</p>
            <input className="glass-input" placeholder={t("volunteer.searchSpecialty")} value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {filtered.map((s) => (
                <button key={s} onClick={() => { setEditSpecialty(s === editSpecialty ? null : s); setEditCustom(""); }} className={`glass-btn glass-btn-sm w-full text-start ${editSpecialty === s ? "glass-btn-primary" : ""}`}>{t(`volunteer.specialty_${s}`)}</button>
              ))}
              <button onClick={() => setEditSpecialty(editSpecialty === "__custom" ? null : "__custom")} className={`glass-btn glass-btn-sm w-full text-start ${editSpecialty === "__custom" ? "glass-btn-primary" : ""}`} style={editSpecialty !== "__custom" ? { borderStyle: "dashed" } : undefined}>{t("volunteer.customSpecialty")}</button>
            </div>
            {editSpecialty === "__custom" && <input className="glass-input" placeholder={t("volunteer.customSpecialtyPlaceholder")} value={editCustom} onChange={(e) => setEditCustom(e.target.value)} />}
            {!editSpecialty && <p className="text-tertiary text-xs">{t("volunteer.noSpecialtyHint")}</p>}
          </div>
        )}
        <div className="flex gap-3">
          <button className="glass-btn flex-1" onClick={() => { setEditing(false); setSearch(""); }}>{t("common.cancel")}</button>
          <button className="glass-btn glass-btn-primary flex-1" onClick={handleSave}>{t("common.save")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass glass-animate p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: isVolunteer ? "rgba(34,197,94,0.15)" : "rgba(156,163,175,0.15)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill={isVolunteer ? "rgb(34,197,94)" : "rgb(156,163,175)"} opacity="0.8" /></svg>
        </div>
        <div className="flex-1">
          <p className="text-primary text-sm font-medium">{t("volunteer.title")}</p>
          <p className="text-secondary text-xs">
            {isVolunteer ? specialty ? specialty.startsWith("custom:") ? specialty.slice(7) : t(`volunteer.specialty_${specialty}`) : t("volunteer.generalVolunteer") : t("volunteer.notVolunteer")}
          </p>
        </div>
        <button onClick={startEdit} className="glass-btn glass-btn-sm">{t("volunteer.edit")}</button>
      </div>
    </div>
  );
}

// ======================== DISTRIBUTOR SECTION ========================

function DistributorSection() {
  const { t } = useTranslation();
  const { isDistributor, storeDescription, status, storeAddress, setDistributor } = useDistributorStore();
  const [editing, setEditing] = useState(false);
  const [editWants, setEditWants] = useState(isDistributor);
  const [editAddress, setEditAddress] = useState(storeAddress);
  const [editDesc, setEditDesc] = useState(storeDescription);

  const handleSave = () => { setDistributor(editWants, editAddress, editDesc); setEditing(false); window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"); };
  const startEdit = () => { setEditWants(isDistributor); setEditAddress(storeAddress); setEditDesc(storeDescription); setEditing(true); };
  const statusColor = (s: string) => s === "approved" ? "rgb(34,197,94)" : s === "rejected" ? "rgb(239,68,68)" : "rgb(234,179,8)";
  const statusBg = (s: string) => s === "approved" ? "rgba(34,197,94,0.15)" : s === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)";

  if (editing) {
    return (
      <div className="glass glass-animate space-y-4 p-5">
        <h3 className="text-primary font-semibold">{t("distributor.title")}</h3>
        <p className="text-secondary text-sm">{t("distributor.description")}</p>
        <div className="glass-subtle space-y-2 rounded-xl p-3">
          <p className="text-primary text-xs font-medium">{t("distributor.incentiveTitle")}</p>
          <ul className="text-secondary space-y-1 text-xs">
            <li>• {t("distributor.incentive1")}</li>
            <li>• {t("distributor.incentive2")}</li>
            <li>• {t("distributor.incentive3")}</li>
          </ul>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditWants(true)} className={`glass-btn flex-1 ${editWants ? "glass-btn-primary" : ""}`}>{t("distributor.yes")}</button>
          <button onClick={() => { setEditWants(false); setEditAddress(""); setEditDesc(""); }} className={`glass-btn flex-1 ${!editWants ? "glass-btn-primary" : ""}`}>{t("distributor.no")}</button>
        </div>
        {editWants && (
          <div className="space-y-3">
            <input className="glass-input" placeholder={t("distributor.storeAddress")} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            <textarea className="glass-input" placeholder={t("distributor.storeDescription")} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} style={{ resize: "none" }} />
            <p className="text-tertiary text-xs">{t("distributor.pendingNote")}</p>
          </div>
        )}
        <div className="flex gap-3">
          <button className="glass-btn flex-1" onClick={() => setEditing(false)}>{t("common.cancel")}</button>
          <button className="glass-btn glass-btn-primary flex-1" onClick={handleSave} disabled={editWants && (!editAddress || !editDesc)}>{t("common.save")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass glass-animate p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: isDistributor ? "rgba(59,130,246,0.15)" : "rgba(156,163,175,0.15)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 9l1.5-5h15L21 9" stroke={isDistributor ? "rgb(59,130,246)" : "rgb(156,163,175)"} strokeWidth="2" />
            <path d="M3 9v12h18V9" fill={isDistributor ? "rgba(59,130,246,0.1)" : "rgba(156,163,175,0.1)"} />
            <path d="M3 9v12h18V9" stroke={isDistributor ? "rgb(59,130,246)" : "rgb(156,163,175)"} strokeWidth="2" />
            <rect x="9" y="14" width="6" height="7" rx="1" fill={isDistributor ? "rgba(59,130,246,0.4)" : "rgba(156,163,175,0.3)"} />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-primary text-sm font-medium">{t("distributor.title")}</p>
          <p className="text-secondary text-xs">{isDistributor ? storeDescription : t("distributor.notDistributor")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDistributor && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: statusBg(status), color: statusColor(status) }}>{t(`distributor.status_${status}`)}</span>}
          <button onClick={startEdit} className="glass-btn glass-btn-sm">{t("volunteer.edit")}</button>
        </div>
      </div>
    </div>
  );
}

// ======================== HELPERS ========================

function InfoRow({ label, value, mono, badge }: { label: string; value: string; mono?: boolean; badge?: "green" | "yellow" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary text-sm">{label}</span>
      {badge ? (
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
          background: badge === "green" ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
          color: badge === "green" ? "rgb(34,197,94)" : "rgb(234,179,8)",
        }}>{value}</span>
      ) : (
        <span className={`text-primary text-sm font-medium ${mono ? "font-mono tracking-wider" : ""}`}>{value}</span>
      )}
    </div>
  );
}
