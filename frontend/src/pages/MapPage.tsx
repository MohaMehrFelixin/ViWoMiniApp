import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DistributionCenter } from "../lib/types";
import { getNearbyCenters } from "../api/coupon";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";

const TEHRAN = { lat: 35.6892, lng: 51.389 };

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const centerIcon = (status: string, isSelected: boolean) =>
  L.divIcon({
    className: "",
    iconSize: isSelected ? [44, 44] : [36, 36],
    iconAnchor: isSelected ? [22, 22] : [18, 18],
    html: `<div style="
      width:${isSelected ? 44 : 36}px;height:${isSelected ? 44 : 36}px;
      border-radius:14px;
      display:flex;align-items:center;justify-content:center;
      background:${status === "open" ? "var(--accent)" : status === "low_stock" ? "#F97316" : "#EF4444"};
      box-shadow:0 4px 12px ${status === "open" ? "rgba(0,122,255,0.4)" : "rgba(0,0,0,0.3)"};
      border:2px solid rgba(255,255,255,0.9);
      transition:all 0.2s ease;
      ${isSelected ? "transform:scale(1.1);" : ""}
    "><svg width="${isSelected ? 20 : 16}" height="${isSelected ? 20 : 16}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  });

const userIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:var(--accent);border:3px solid #fff;
    box-shadow:0 0 0 6px rgba(0,122,255,0.2),0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
});

function FitBounds({ centers, userPos }: { centers: DistributionCenter[]; userPos: L.LatLng | null }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || centers.length === 0) return;
    const points: L.LatLngExpression[] = centers.map((c) => [c.lat, c.lng]);
    if (userPos) points.push(userPos);
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 13 });
    fitted.current = true;
  }, [centers, userPos, map]);
  return null;
}

function FlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!center) return;
    const key = `${center[0]},${center[1]}`;
    if (prev.current === key) return;
    prev.current = key;
    map.flyTo(center, 15, { duration: 0.8 });
  }, [center, map]);
  return null;
}

const statusColor = (s: string) =>
  s === "open" ? "#22C55E" : s === "low_stock" ? "#F97316" : "#EF4444";

export function MapPage() {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<DistributionCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<L.LatLng | null>(null);
  const [selected, setSelected] = useState<DistributionCenter | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    const load = async (lat: number, lng: number, isUser: boolean) => {
      try {
        if (isUser) setUserPos(L.latLng(lat, lng));
        const res = await getNearbyCenters(lat, lng);
        if (res.centers.length > 0) {
          setCenters(res.centers);
        } else {
          const fb = await getNearbyCenters(TEHRAN.lat, TEHRAN.lng);
          setCenters(fb.centers);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    };
    if (!navigator.geolocation) { load(TEHRAN.lat, TEHRAN.lng, false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => load(pos.coords.latitude, pos.coords.longitude, true),
      () => load(TEHRAN.lat, TEHRAN.lng, false),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const mapCenter = userPos
    ? { lat: userPos.lat, lng: userPos.lng }
    : centers[0]
      ? { lat: centers[0].lat, lng: centers[0].lng }
      : TEHRAN;

  const statusLabel = (s: string) =>
    s === "open" ? t("map.open") : s === "low_stock" ? t("map.lowStock") : t("map.closed");

  const typeLabel = (tp: string) =>
    tp === "government" ? t("map.typeGov") : tp === "mobile" ? t("map.typeMobile") : t("map.typePrivate");

  const selectCenter = (c: DistributionCenter) => {
    setSelected(c);
    setSheetOpen(true);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Full-screen map */}
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={12}
        className="absolute inset-0 z-0 h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={isDark ? DARK_TILES : LIGHT_TILES} />
        <FitBounds centers={centers} userPos={userPos} />
        <FlyTo center={selected ? [selected.lat, selected.lng] : null} />

        {userPos && <Marker position={userPos} icon={userIcon} />}
        {centers.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={centerIcon(c.status, selected?.id === c.id)}
            eventHandlers={{ click: () => selectCenter(c) }}
          />
        ))}
      </MapContainer>

      {/* Top floating island */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[999] flex justify-center px-6 pt-3">
        <div
          className="glass-tabbar pointer-events-auto px-5 py-2.5"
          style={{ minWidth: 0, width: "auto", gap: 10 }}
        >
          <span className="text-primary text-sm font-semibold">{t("map.title")}</span>
          <span
            className="flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-[11px] font-bold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {centers.length}
          </span>
        </div>
      </div>

      {/* Bottom sheet */}
      <div
        className="absolute inset-x-0 z-[999] transition-all duration-300 ease-out"
        style={{
          bottom: "90px",
          maxHeight: sheetOpen && selected ? "calc(100vh - 160px)" : "180px",
          padding: "0 12px",
        }}
      >
        <div
          className="glass overflow-hidden"
          style={{ borderRadius: "20px", maxHeight: sheetOpen && selected ? "60vh" : "180px" }}
        >
          {selected && sheetOpen ? (
            /* Selected center detail */
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: `${statusColor(selected.status)}15` }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={statusColor(selected.status)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-primary text-base font-bold">{selected.name}</h2>
                  <p className="text-tertiary mt-0.5 text-xs">{typeLabel(selected.type)}</p>
                </div>
                <button
                  onClick={() => { setSelected(null); setSheetOpen(false); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: "var(--separator)" }}
                >
                  <span className="text-secondary text-sm leading-none">✕</span>
                </button>
              </div>

              <p className="text-secondary mt-3 text-sm leading-relaxed">{selected.address}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ background: `${statusColor(selected.status)}15`, color: statusColor(selected.status) }}
                >
                  {statusLabel(selected.status)}
                </span>
                <span className="glass-subtle rounded-full px-3 py-1.5 text-xs" style={{ color: "var(--text-2)" }}>
                  {selected.operating_hours}
                </span>
                {selected.queue_minutes > 0 && (
                  <span className="glass-subtle rounded-full px-3 py-1.5 text-xs" style={{ color: "var(--text-2)" }}>
                    {selected.queue_minutes} {t("map.minutes")}
                  </span>
                )}
              </div>

              <button
                className="glass-btn glass-btn-primary glass-btn-lg mt-4"
                onClick={() =>
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`, "_blank")
                }
              >
                {t("map.directions")}
              </button>
            </div>
          ) : (
            /* Center list */
            <div className="overflow-y-auto" style={{ maxHeight: "170px" }}>
              {centers.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => selectCenter(c)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-start active:opacity-70"
                  style={{
                    borderBottom: i < centers.length - 1 ? "0.5px solid var(--separator)" : "none",
                  }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${statusColor(c.status)}12` }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={statusColor(c.status)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-primary truncate text-sm font-semibold">{c.name}</div>
                    <div className="text-tertiary mt-0.5 truncate text-xs">{c.address}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: `${statusColor(c.status)}15`, color: statusColor(c.status) }}
                    >
                      {statusLabel(c.status)}
                    </span>
                    <span className="text-tertiary text-[10px]">{c.operating_hours}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
