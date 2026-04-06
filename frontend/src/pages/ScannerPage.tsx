import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { redeemCoupon } from "../api/coupon";
import { ErrorState } from "../components/ErrorState";
import { IconCheck } from "../components/Icons";

export function ScannerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton;
    back?.show();
    const handler = () => navigate(-1);
    back?.onClick(handler);
    return () => {
      back?.offClick(handler);
      back?.hide();
    };
  }, [navigate]);

  useEffect(() => {
    if (!scanning) return;

    let animFrame: number;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanFrame();
        }
      } catch {
        setError("Camera access denied");
        setScanning(false);
      }
    };

    const scanFrame = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animFrame = requestAnimationFrame(scanFrame);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      if ("BarcodeDetector" in window) {
        // @ts-expect-error BarcodeDetector is not in all TS libs
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        detector
          .detect(canvas)
          .then((barcodes: Array<{ rawValue: string }>) => {
            if (barcodes.length > 0 && barcodes[0]) {
              handleScanResult(barcodes[0].rawValue);
              return;
            }
            animFrame = requestAnimationFrame(scanFrame);
          })
          .catch(() => {
            animFrame = requestAnimationFrame(scanFrame);
          });
      } else {
        animFrame = requestAnimationFrame(scanFrame);
      }
    };

    startCamera();

    return () => {
      cancelAnimationFrame(animFrame);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const handleScanResult = (data: string) => {
    setScanning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setResult(data);
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
  };

  const handleRedeem = async () => {
    if (!result) return;
    setRedeeming(true);
    setError(null);
    try {
      await redeemCoupon(result, 0);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      navigate("/history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redemption failed");
      setRedeeming(false);
    }
  };

  if (error && !result) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setError(null);
          setScanning(true);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6 p-6">
      <h1 className="text-primary text-xl font-bold">{t("scanner.title")}</h1>

      {scanning && (
        <>
          <p className="text-secondary text-sm">{t("scanner.instruction")}</p>
          <div className="glass glass-prominent overflow-hidden rounded-3xl p-1">
            <div className="relative overflow-hidden rounded-[22px]">
              <video
                ref={videoRef}
                className="h-72 w-72 object-cover"
                playsInline
                muted
              />
              {/* Scan overlay */}
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute inset-4 rounded-2xl"
                  style={{
                    border: "2px solid rgba(59, 130, 246, 0.6)",
                    boxShadow: "0 0 30px rgba(59, 130, 246, 0.15)",
                  }}
                />
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </>
      )}

      {result && !scanning && (
        <div className="glass glass-prominent glass-animate flex w-full max-w-sm flex-col items-center space-y-4 p-6">
          <div style={{ color: "var(--cat-food)" }}><IconCheck size={48} /></div>
          <p className="text-primary font-semibold">QR Scanned</p>
          {error && (
            <p className="text-sm" style={{ color: "var(--cat-medical)" }}>
              {error}
            </p>
          )}
          <div className="flex w-full gap-3">
            <button
              className="glass-btn flex-1"
              onClick={() => {
                setResult(null);
                setError(null);
                setScanning(true);
              }}
            >
              {t("common.retry")}
            </button>
            <button
              className="glass-btn glass-btn-primary flex-1"
              onClick={handleRedeem}
              disabled={redeeming}
            >
              {redeeming ? "..." : t("common.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
