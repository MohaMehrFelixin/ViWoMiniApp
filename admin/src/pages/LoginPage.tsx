import { useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { requestOTP, verifyOTP } from "../api/admin";
import { ShieldCheck, Loader2 } from "lucide-react";

type Step = "national_code" | "otp";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<Step>("national_code");
  const [nationalCode, setNationalCode] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  if (isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const normalizeDigits = (raw: string) =>
    raw
      .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
      .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
      .replace(/\D/g, "");

  const handleRequestOTP = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await requestOTP(nationalCode);
      setMaskedPhone(res.phone || "");
      setStep("otp");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      setError(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleVerifyOTP = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await verifyOTP(nationalCode, otp);
      login(res.session_token, res.admin);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code";
      setError(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="card w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(59,130,246,0.12)" }}>
            <ShieldCheck size={28} style={{ color: "var(--accent)" }} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: "var(--text-1)" }}>ViWo Admin</h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Crisis Management Panel</p>
          </div>
        </div>

        {step === "national_code" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>National Code</label>
              <input
                className="input text-center tracking-[0.2em] font-mono text-lg"
                placeholder="_ _ _ _ _ _ _ _ _ _"
                value={nationalCode}
                onChange={(e) => setNationalCode(normalizeDigits(e.target.value).slice(0, 10))}
                inputMode="numeric"
                maxLength={10}
                autoFocus
                dir="ltr"
              />
            </div>

            {error && (
              <div className="rounded-lg p-3 text-xs text-center" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary w-full py-3"
              onClick={handleRequestOTP}
              disabled={nationalCode.length !== 10 || loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Send Verification Code"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs" style={{ color: "var(--text-2)" }}>
                Code sent to <span className="font-mono font-semibold" style={{ color: "var(--text-1)" }}>{maskedPhone}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>Verification Code</label>
              <input
                className="input text-center tracking-[0.4em] font-mono text-2xl"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(normalizeDigits(e.target.value).slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                autoFocus
                dir="ltr"
              />
            </div>

            {error && (
              <div className="rounded-lg p-3 text-xs text-center" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary w-full py-3"
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify & Login"}
            </button>

            <button
              className="btn w-full"
              onClick={() => { setStep("national_code"); setOtp(""); setError(""); }}
              disabled={loading}
            >
              Back
            </button>
          </div>
        )}

        {/* Security notice */}
        <p className="text-[10px] text-center mt-6" style={{ color: "var(--text-3)" }}>
          Secured with server-side sessions. All actions are audited.
        </p>
      </div>
    </div>
  );
}
