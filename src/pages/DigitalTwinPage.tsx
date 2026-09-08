import React, { useState, useEffect, useMemo } from "react";
import {
  Activity, RefreshCw, Zap, Droplet, Sun, Sprout, ShieldCheck, MapPin,
  AlertTriangle, TrendingUp, Layers, Tractor, FlaskConical, Bug, CloudRain,
} from "lucide-react";
import { useLocation } from "../contexts/LocationContext";
import {
  fetchTwinState, loadTwinField, wiltThreshold,
  type TwinState, type TwinAdvisory,
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

export default function DigitalTwinPage() {
  const { latitude, longitude, state, district, refreshLocation } = useLocation();
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const field = useMemo(() => loadTwinField(), [lastSync]);

  const load = (force = false) => {
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
  };

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [latitude, longitude, state]);

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
  const minProjected = Math.min(...t.projection.map((p) => p.moisture));
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
              {t.fieldName || `${district || t.district} Farm Plot`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.district}, {t.state} &bull; {t.soilClass} soil</span>
              {t.areaAcres != null && <span className="font-semibold text-slate-700">&bull; {t.areaAcres} acres</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerPulse}
              disabled={pulsing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${pulsing ? "animate-bounce text-amber-300" : ""}`} />
              <span>{pulsing ? "Syncing live sensors…" : "Refresh Twin Data"}</span>
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

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Root-Zone Moisture</span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600"><Droplet className="w-4 h-4" /></span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{rootZone}%</div>
            <div className="mt-2 text-xs font-semibold text-blue-600">Wilting point for this soil: {wilting}%</div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden relative">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (rootZone / 50) * 100)}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Soil Temp (0-7cm)</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Sun className="w-4 h-4" /></span>
            </div>
            <div className="text-3xl font-extrabold text-slate-900">{t.soilTemp0to7}°C</div>
            <div className="mt-2 text-xs text-slate-500">Air: {t.airTemp}°C &bull; Humidity: {t.humidity}%</div>
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

        {/* Soil profile layers */}
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

        {/* 7-day projection */}
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
            {/* today's actual as first bar */}
            {[{ day: "Today", moisture: rootZone, rainMm: t.rainToday }, ...t.projection].map((p, i) => {
              const h = Math.max(8, (p.moisture / maxChart) * 100);
              const below = p.moisture < wilting;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className={`text-[10px] font-bold ${below ? "text-rose-600" : "text-slate-700"}`}>{p.moisture}%</span>
                  {p.rainMm > 1 && (
                    <span className="text-[9px] font-semibold text-blue-500">🌧{p.rainMm >= 10 ? p.rainMm : ""}</span>
                  )}
                  <div
                    className={`w-full rounded-t-lg transition-all ${below ? "bg-gradient-to-t from-rose-500 to-rose-300" : "bg-gradient-to-t from-blue-600 to-sky-300"}`}
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">{p.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Above wilting point</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500 inline-block" />Below wilting point ({wilting}%)</span>
            <span className="flex items-center gap-1.5">🌧 = forecast rain (mm)</span>
          </div>
        </div>

        {/* Advisories */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Tractor className="w-5 h-5 text-emerald-600" />
              <span>This Week's Farm Advisories</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Generated from live soil moisture, 7-day forecast and {t.state} soil data — simple, explainable rules you can verify.
            </p>
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

        {/* Crop recommendations */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-600" />
              <span>Best Crops for Your Soil & Season</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Matched on your soil pH ({t.ph}), current root-zone moisture, and the {new Date().getMonth() >= 5 && new Date().getMonth() <= 9 ? "Kharif" : "Rabi"} season.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.crops.map((c) => (
              <div key={c.name} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{c.name}</span>
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
