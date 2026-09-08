import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Activity, RefreshCw, Zap, Droplet, Sun, Sprout, ShieldCheck, MapPin,
  AlertTriangle, TrendingUp, Layers, Tractor, FlaskConical, Bug, CloudRain,
  Map as MapIcon, Ruler, Pencil, Crosshair, Sparkles, CheckCircle2,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocation } from "../contexts/LocationContext";
import {
  fetchTwinState, loadTwinField, saveTwinField, wiltThreshold,
  type TwinState, type TwinAdvisory, type TwinProjectionPoint,
} from "../lib/digitalTwinData";

const ADVISORY_STYLE: Record<TwinAdvisory["severity"], { border: string; bg: string; icon: React.ReactNode }> = {
  good: { border: "border-emerald-200", bg: "bg-emerald-50", icon: <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> },
  caution: { border: "border-amber-200", bg: "bg-amber-50", icon: <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" /> },
  alert: { border: "border-rose-200", bg: "bg-rose-50", icon: <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" /> },
};

const ADVISORY_ICON: Record<TwinAdvisory["type"], React.ReactNode> = {
  irrigation: <Droplet className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />,
  yield: <TrendingUp className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />,
  fertilizer: <FlaskConical className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />,
  pest: <Bug className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />,
  info: <Activity className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />,
};

function MoistureBar({ label, value, threshold }: { label: string; value: number; threshold: number }) {
  const pct = Math.min(100, (value / 50) * 100);
  const th = Math.min(100, (threshold / 50) * 100);
  const color = value < threshold ? "bg-rose-500" : value < threshold + 8 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className={`font-bold ${value < threshold ? "text-rose-600" : "text-slate-800"}`}>{value}%</span>
      </div>
      <div className="relative w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-rose-800" style={{ left: `${th}%` }} title={`Wilting point ${threshold}%`} />
      </div>
    </div>
  );
}

// ---------------- Satellite mini-map with tap-to-draw ----------------
function FarmMap({
  field, lat, lon, onFieldSaved,
}: {
  field: ReturnType<typeof loadTwinField>;
  lat: number;
  lon: number;
  onFieldSaved: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polyRef = useRef<L.Polygon | null>(null);
  const markerRefs = useRef<L.Marker[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [pts, setPts] = useState<{ lat: number; lng: number }[]>(field?.coordinates ?? []);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = field?.centroid
      ? [field.centroid.lat, field.centroid.lng]
      : [lat, lon];
    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, 17);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw polygon when pts change
  const redraw = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (polyRef.current) { map.removeLayer(polyRef.current); polyRef.current = null; }
    markerRefs.current.forEach((m) => map.removeLayer(m));
    markerRefs.current = [];
    if (pts.length >= 3) {
      const latlngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
      const poly = L.polygon(latlngs, { color: "#10b981", fillColor: "#10b981", fillOpacity: 0.25, weight: 3 }).addTo(map);
      polyRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    }
    pts.forEach((p) => {
      const m = L.circleMarker([p.lat, p.lng], { radius: 5, color: "#fff", fillColor: "#10b981", fillOpacity: 1, weight: 2 }).addTo(map);
      markerRefs.current.push(m as unknown as L.Marker);
    });
  }, [pts]);

  useEffect(() => { redraw(); }, [redraw]);

  const toggleDrawing = () => {
    const map = mapRef.current;
    if (!map) return;
    if (drawing) {
      map.off("click");
      setDrawing(false);
      return;
    }
    setDrawing(true);
    map.on("click", (e: L.LeafletMouseEvent) => {
      setPts((prev) => [...prev, { lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) }]);
    });
  };

  const clearPts = () => {
    setPts([]);
    const map = mapRef.current;
    if (map) map.off("click");
    setDrawing(false);
  };

  const acres = useMemo(() => {
    if (pts.length < 3) return 0;
    const R = 6371000;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const lat1 = (p1.lat * Math.PI) / 180;
      const lat2 = (p2.lat * Math.PI) / 180;
      const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
      area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    area = Math.abs((area * R * R) / 2);
    return Math.round((area / 4046.86) * 100) / 100;
  }, [pts]);

  const saveField = () => {
    if (pts.length < 3) return;
    const centroid = {
      lat: pts.reduce((a, p) => a + p.lat, 0) / pts.length,
      lng: pts.reduce((a, p) => a + p.lng, 0) / pts.length,
    };
    saveTwinField({
      name: "My Farm Plot",
      areaAcres: acres,
      centroid,
      coordinates: pts,
      savedAt: new Date().toISOString(),
    });
    onFieldSaved();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-teal-50 text-teal-600"><MapIcon className="w-4 h-4" /></span>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">My Farm Map</h2>
            <p className="text-[11px] text-slate-500">
              {field ? `${field.name} • ${field.areaAcres} acres` : "Tap points on the satellite view to trace your field boundary"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!drawing ? (
            <button
              onClick={toggleDrawing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" /> {field ? "Redraw boundary" : "Draw boundary"}
            </button>
          ) : (
            <>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                Tap map to add corners ({pts.length})
              </span>
              <button onClick={clearPts} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 text-xs font-bold cursor-pointer transition-colors">
                Clear
              </button>
              <button
                onClick={toggleDrawing}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={containerRef} className="w-full h-[320px] sm:h-[400px] relative z-10" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5 text-slate-400" /> {acres > 0 ? `${acres} acres traced` : field ? `${field.areaAcres} acres (saved)` : "No area yet"}</span>
          <span className="flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5 text-slate-400" /> {lat.toFixed(3)}°, {lon.toFixed(3)}°</span>
        </div>
        <button
          onClick={saveField}
          disabled={pts.length < 3}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-3.5 h-3.5" /> Save & link to Digital Twin
        </button>
      </div>
    </div>
  );
}

// ---------------- Main page ----------------
export default function DigitalTwinPage() {
  const { latitude, longitude, state, district, refreshLocation } = useLocation();
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [fieldSavedTick, setFieldSavedTick] = useState(0);

  const field = useMemo(() => loadTwinField(), [fieldSavedTick]);

  const load = useCallback((force = false) => {
    setLoading(true);
    setError(null);
    const lat = latitude ?? 28.6139;
    const lon = longitude ?? 77.2090;
    fetchTwinState(
      lat,
      lon,
      state || "Delhi",
      district || "New Delhi",
      { name: field?.name ?? null, areaAcres: field?.areaAcres ?? null },
      { force }
    )
      .then(setTwin)
      .catch((e) => setError(e?.message || "Could not load digital twin data"))
      .finally(() => setLoading(false));
  }, [latitude, longitude, state, district, field?.name, field?.areaAcres]);

  useEffect(() => { load(); }, [load]);

  const triggerPulse = () => {
    setPulsing(true);
    load(true);
    setTimeout(() => setPulsing(false), 1200);
  };

  if (loading && !twin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs text-slate-500">Syncing live soil moisture, ET0 and weather…</p>
      </div>
    );
  }

  if (error && !twin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-slate-700 font-semibold">{error}</p>
        <button onClick={() => load(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">Retry</button>
      </div>
    );
  }

  const t = twin!;
  const wilting = wiltThreshold(t.soilClass);
  const rootZone = Math.round(((t.moisture1to3 + t.moisture3to9) / 2) * 10) / 10;
  const maxChart = Math.max(...t.projection.map((p) => p.moisture), rootZone) * 1.15;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-2">
              <Activity className="w-3.5 h-3.5" />
              <span>Live Farm Digital Twin</span>
              {t.isEstimated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold" title="Live satellite data temporarily unavailable — showing climate-based estimate">
                  <AlertTriangle className="w-3 h-3" /> Estimated
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {field?.name || t.fieldName || `${t.district} Farm Plot`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.district}, {t.state} • {t.soilClass} soil</span>
              {(field?.areaAcres ?? t.areaAcres) != null && <span className="font-semibold text-slate-700">• {field?.areaAcres ?? t.areaAcres} acres</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerPulse}
              disabled={pulsing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${pulsing ? "animate-bounce text-amber-300" : ""}`} />
              <span>{pulsing ? "Syncing…" : "Refresh Twin Data"}</span>
            </button>
            <button
              onClick={() => { refreshLocation(); }}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Refresh GPS location"
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===== 1. FARM MAP (digital map of the actual field) ===== */}
        <FarmMap field={field} lat={t.lat} lon={t.lon} onFieldSaved={() => setFieldSavedTick((x) => x + 1)} />

        {/* ===== 2. WHAT TO DO THIS WEEK (the farmer's action plan) ===== */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Tractor className="w-5 h-5" /></span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">What to do on your farm this week</h2>
              <p className="text-xs text-slate-500">
                Personalized from your field's live soil moisture, 7-day weather and {t.state} soil data.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {t.advisories.map((a, i) => {
              const st = ADVISORY_STYLE[a.severity];
              return (
                <div key={i} className={`p-4 rounded-2xl border ${st.border} ${st.bg} flex items-start gap-3`}>
                  {ADVISORY_ICON[a.type]}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{a.title}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{a.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== 3. BEST CROPS TO GROW ===== */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-lime-50 text-lime-600"><Sprout className="w-5 h-5" /></span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Best crops to grow on this soil, right now</h2>
              <p className="text-xs text-slate-500">
                Matched on your soil pH ({t.ph}), current root-zone moisture ({rootZone}%), and the {new Date().getMonth() >= 5 && new Date().getMonth() <= 9 ? "Kharif" : "Rabi"} season.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.crops.map((c) => (
              <div key={c.name} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{c.emoji} {c.name}</span>
                  <span className={`text-xs font-extrabold px-2 py-1 rounded-full ${c.score >= 80 ? "bg-emerald-100 text-emerald-800" : c.score >= 65 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                    {c.score}% fit
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div className={`h-full rounded-full ${c.score >= 80 ? "bg-emerald-500" : c.score >= 65 ? "bg-amber-500" : "bg-slate-400"}`} style={{ width: `${c.score}%` }} />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">{c.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ===== 4. LIVE SOIL STATE (the "twin" measurements) ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Root-Zone Moisture</span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600"><Droplet className="w-4 h-4" /></span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{rootZone}%</div>
            <div className="mt-2 text-xs font-semibold text-blue-600">Wilting point: {wilting}%</div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (rootZone / 50) * 100)}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Soil Temp (0-7cm)</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Sun className="w-4 h-4" /></span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{t.soilTemp0to7}°C</div>
            <div className="mt-2 text-xs text-slate-500">Air: {t.airTemp}°C • Humidity: {t.humidity}%</div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Water Use (ET₀)</span>
              <span className="p-2 rounded-xl bg-teal-50 text-teal-600"><CloudRain className="w-4 h-4" /></span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{t.et0} <span className="text-sm font-semibold text-slate-400">mm/day</span></div>
            <div className="mt-2 text-xs text-slate-500">Today's rain: {t.rainToday} mm</div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Soil Chemistry (state)</span>
              <span className="p-2 rounded-xl bg-violet-50 text-violet-600"><FlaskConical className="w-4 h-4" /></span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{t.ph}</div>
            <div className="mt-2 text-xs text-slate-500 truncate">N: {t.nitrogen} | P: {t.phosphorus} | K: {t.potassium} kg/ha</div>
            <div className="mt-2 text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md inline-block">
              from {t.state} soil dataset
            </div>
          </div>
        </div>

        {/* ===== 5. MOISTURE BY DEPTH ===== */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Live Soil Moisture by Depth (satellite-derived)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Red line marks the wilting point ({wilting}% for {t.soilClass}). Below it, crops cannot pull water.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <MoistureBar label="Surface (0-1 cm)" value={t.moisture0to1} threshold={wilting} />
            <MoistureBar label="Shallow (1-3 cm)" value={t.moisture1to3} threshold={wilting} />
            <MoistureBar label="Root zone (3-9 cm)" value={t.moisture3to9} threshold={wilting} />
            <MoistureBar label="Deep root (9-27 cm)" value={t.moisture9to27} threshold={wilting} />
          </div>
        </div>

        {/* ===== 6. 7-DAY MOISTURE PROJECTION ===== */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>7-Day Moisture Projection</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Water-balance model: each bar starts at today's root-zone moisture, loses water to evaporation (ET₀) and gains from forecast rain.
            </p>
          </div>
          <div className="flex items-end gap-2 h-44 px-2">
            {[{ day: "Today", moisture: rootZone, rainMm: t.rainToday } as TwinProjectionPoint, ...t.projection].map((p, i) => {
              const h = Math.max(8, (p.moisture / maxChart) * 100);
              const below = p.moisture < wilting;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className={`text-[10px] font-bold ${below ? "text-rose-600" : "text-slate-700"}`}>{p.moisture}%</span>
                  {p.rainMm > 1 && <span className="text-[9px] font-semibold text-blue-500">🌧{p.rainMm >= 10 ? p.rainMm : ""}</span>}
                  <div
                    className={`w-full rounded-t-lg transition-all ${below ? "bg-gradient-to-t from-rose-500 to-rose-300" : "bg-gradient-to-t from-blue-600 to-sky-300"}`}
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">{p.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Above wilting point</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500 inline-block" />Below wilting point ({wilting}%)</span>
            <span className="flex items-center gap-1.5">🌧 = forecast rain (mm)</span>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-slate-400 text-center max-w-2xl mx-auto leading-relaxed">
          Soil moisture, temperature and ET₀ come from the Open-Meteo satellite soil model at your GPS location.
          N-P-K and pH are state-level reference values ({t.state}) — for exact field values, get a free government Soil Health Card test.
          Last synced {new Date(t.fetchedAt).toLocaleTimeString()}.
        </p>
      </div>
    </div>
  );
}
