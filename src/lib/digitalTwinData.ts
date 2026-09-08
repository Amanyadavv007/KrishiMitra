// ============================================================
// Digital Twin data engine — 100% client-side, no backend needed
// Sources:
//  - Open-Meteo forecast API: satellite-derived soil moisture at 4 depths,
//    FAO-56 reference evapotranspiration (ET0), rain + temp forecast (free, no key)
//  - datasets/state_soil_data.csv: state-level N, P, K, pH (embedded below)
//  - Transparent water-balance model -> irrigation, yield, crop & fertilizer advisories
// Rate-limit resilience:
//  - 10-minute localStorage cache per location (avoids repeat 429s on navigation)
//  - Retry with backoff on 429/5xx
//  - Climate-based fallback estimate so the page NEVER dead-ends
// ============================================================

export interface TwinAdvisory {
  type: "irrigation" | "yield" | "fertilizer" | "pest" | "info";
  title: string;
  body: string;
  severity: "good" | "caution" | "alert";
}

export interface CropFit {
  name: string;
  emoji: string;
  score: number; // 0-100
  reason: string;
}

export interface TwinProjectionPoint {
  day: string;
  moisture: number;
  rainMm: number;
  et0Mm: number;
}

export interface TwinState {
  // location
  lat: number;
  lon: number;
  state: string;
  district: string;
  // field (from Field Mapping, optional)
  fieldName: string | null;
  areaAcres: number | null;
  // live conditions (Open-Meteo)
  airTemp: number;
  humidity: number;
  rainToday: number; // mm
  et0: number; // mm/day reference evapotranspiration
  // soil profile (Open-Meteo soil model)
  moisture0to1: number;
  moisture1to3: number;
  moisture3to9: number;
  moisture9to27: number;
  soilTemp0to7: number;
  // chemistry (state dataset)
  ph: number;
  nitrogen: number; // kg/ha
  phosphorus: number;
  potassium: number;
  soilClass: string;
  // projections & advisories
  projection: TwinProjectionPoint[];
  advisories: TwinAdvisory[];
  crops: CropFit[];
  fetchedAt: string;
  isEstimated: boolean; // true when Open-Meteo was unavailable (fallback model used)
}

// ---- State soil chemistry (datasets/state_soil_data.csv) ----
interface StateSoil { ph: number; n: number; p: number; k: number; class: string }

const STATE_SOIL: Record<string, StateSoil> = {
  "Andhra Pradesh": { ph: 6.8, n: 78, p: 45, k: 22, class: "Red Loamy" },
  "Arunachal Pradesh": { ph: 5.5, n: 55, p: 15, k: 35, class: "Forest Loam" },
  Assam: { ph: 5.8, n: 60, p: 18, k: 38, class: "Alluvial Sandy Loam" },
  Bihar: { ph: 7.2, n: 85, p: 30, k: 25, class: "Gangetic Alluvial" },
  Chhattisgarh: { ph: 6.5, n: 70, p: 35, k: 20, class: "Red Laterite" },
  Delhi: { ph: 7.5, n: 90, p: 40, k: 30, class: "Alluvial" },
  Goa: { ph: 6.2, n: 65, p: 25, k: 45, class: "Coastal Alluvial" },
  Gujarat: { ph: 7.8, n: 75, p: 38, k: 28, class: "Black Cotton" },
  Haryana: { ph: 7.9, n: 130, p: 48, k: 35, class: "Alluvial Loam" },
  "Himachal Pradesh": { ph: 6.0, n: 60, p: 20, k: 40, class: "Mountain Podzol" },
  "Jharkhand": { ph: 6.1, n: 68, p: 22, k: 30, class: "Red Laterite" },
  "Jammu and Kashmir": { ph: 6.7, n: 70, p: 25, k: 42, class: "Mountain Alluvial" },
  Karnataka: { ph: 6.9, n: 72, p: 42, k: 25, class: "Red Sandy Loam" },
  Kerala: { ph: 5.7, n: 65, p: 28, k: 50, class: "Laterite" },
  "Madhya Pradesh": { ph: 7.4, n: 70, p: 40, k: 20, class: "Medium Black" },
  Maharashtra: { ph: 7.1, n: 75, p: 43, k: 26, class: "Deccan Black" },
  Manipur: { ph: 5.9, n: 58, p: 17, k: 37, class: "Valley Alluvial" },
  Meghalaya: { ph: 5.6, n: 52, p: 16, k: 33, class: "Hill Laterite" },
  Mizoram: { ph: 5.7, n: 54, p: 15, k: 34, class: "Hill Loam" },
  Nagaland: { ph: 5.8, n: 56, p: 16, k: 36, class: "Hill Loam" },
  Odisha: { ph: 6.3, n: 67, p: 26, k: 32, class: "Coastal Alluvial Laterite" },
  Puducherry: { ph: 7.0, n: 88, p: 55, k: 40, class: "Coastal Alluvial" },
  Punjab: { ph: 8.0, n: 150, p: 50, k: 40, class: "Alluvial Loam" },
  Sikkim: { ph: 5.5, n: 50, p: 20, k: 30, class: "Mountain Loam" },
  "Tamil Nadu": { ph: 6.6, n: 80, p: 38, k: 30, class: "Red Sandy" },
  Telangana: { ph: 7.0, n: 77, p: 48, k: 24, class: "Red Sandy Loam" },
  Tripura: { ph: 5.9, n: 62, p: 20, k: 35, class: "Alluvial Loam" },
  "Uttar Pradesh": { ph: 7.6, n: 120, p: 45, k: 35, class: "Gangetic Alluvial" },
  Uttarakhand: { ph: 6.4, n: 80, p: 24, k: 38, class: "Mountain Loam" },
  "West Bengal": { ph: 6.2, n: 85, p: 40, k: 45, class: "Deltaic Alluvial" },
};

export function getStateSoil(state: string): StateSoil {
  return STATE_SOIL[state] || { ph: 6.5, n: 70, p: 35, k: 28, class: "Alluvial Loam" };
}

// ---- Simple crop suitability table (pH range, water need, Indian growing windows) ----
interface CropProfile { name: string; emoji: string; pHmin: number; pHmax: number; water: "high" | "medium" | "low"; season: "kharif" | "rabi" | "both" }

const CROPS: CropProfile[] = [
  { name: "Paddy (Rice)", emoji: "🌾", pHmin: 5.5, pHmax: 7.5, water: "high", season: "kharif" },
  { name: "Wheat", emoji: "🌾", pHmin: 6.0, pHmax: 7.8, water: "medium", season: "rabi" },
  { name: "Maize", emoji: "🌽", pHmin: 5.8, pHmax: 7.5, water: "medium", season: "both" },
  { name: "Cotton", emoji: "☁️", pHmin: 6.0, pHmax: 8.2, water: "medium", season: "kharif" },
  { name: "Sugarcane", emoji: "🎋", pHmin: 6.0, pHmax: 7.8, water: "high", season: "both" },
  { name: "Groundnut", emoji: "🥜", pHmin: 6.0, pHmax: 7.5, water: "low", season: "kharif" },
  { name: "Mustard", emoji: "🌻", pHmin: 6.0, pHmax: 7.8, water: "low", season: "rabi" },
  { name: "Chickpea", emoji: "🫘", pHmin: 6.2, pHmax: 8.2, water: "low", season: "rabi" },
  { name: "Tomato", emoji: "🍅", pHmin: 6.0, pHmax: 7.2, water: "medium", season: "both" },
  { name: "Potato", emoji: "🥔", pHmin: 5.5, pHmax: 6.8, water: "medium", season: "rabi" },
  { name: "Onion", emoji: "🧅", pHmin: 6.0, pHmax: 7.5, water: "low", season: "rabi" },
  { name: "Pulses (Moong)", emoji: "🟢", pHmin: 6.0, pHmax: 7.8, water: "low", season: "kharif" },
];

function currentSeason(): "kharif" | "rabi" {
  const m = new Date().getMonth() + 1; // 1-12
  return m >= 6 && m <= 10 ? "kharif" : "rabi";
}

export function scoreCrops(ph: number, avgMoisture: number, season: "kharif" | "rabi"): CropFit[] {
  return CROPS.map((c) => {
    let score = 60;
    const reasons: string[] = [];

    if (ph >= c.pHmin && ph <= c.pHmax) {
      score += 15;
      reasons.push("pH suits it");
    } else {
      const dist = ph < c.pHmin ? c.pHmin - ph : ph - c.pHmax;
      score -= Math.min(25, dist * 12);
      reasons.push(dist > 0.8 ? "pH out of range" : "pH slightly off");
    }

    const waterFit = avgMoisture >= (c.water === "high" ? 40 : c.water === "medium" ? 28 : 15);
    if (waterFit) { score += 12; reasons.push(c.water === "low" ? "drought tolerant for dry soil" : "enough moisture"); }
    else {
      score -= 12;
      reasons.push(c.water === "high" ? "needs more water than soil holds" : "moderate irrigation needed");
    }

    if (c.season === season || c.season === "both") { score += 10; reasons.push("in-season now"); }
    else score -= 15;

    return {
      name: c.name,
      emoji: c.emoji,
      score: Math.max(10, Math.min(98, Math.round(score))),
      reason: reasons.join(" • "),
    };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ---- Water-balance projection: daily moisture decay vs rain recharge ----
export function projectMoisture(
  startMoisture: number,
  dailyRain: number[],
  dailyEt0: number[],
  cropFactor = 1.0
): TwinProjectionPoint[] {
  const dailyDrainPct = (et0: number) => Math.min(4.5, (et0 / 60) * cropFactor);
  const rainRechargePct = (mm: number) => Math.min(3.5, mm / 12);

  let m = startMoisture;
  const out: TwinProjectionPoint[] = [];
  const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`;

  for (let i = 0; i < dailyRain.length; i++) {
    m = Math.max(6, Math.min(48, m - dailyDrainPct(dailyEt0[i] || 3) + rainRechargePct(dailyRain[i] || 0)));
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    out.push({ day: fmt(d), moisture: Math.round(m * 10) / 10, rainMm: dailyRain[i] || 0, et0Mm: Math.round((dailyEt0[i] || 3) * 10) / 10 });
  }
  return out;
}

// ---- Wilt threshold by soil class ----
const WILT_THRESHOLD: Record<string, number> = {
  "Red Laterite": 14, "Laterite": 14, "Red Sandy": 13, "Red Sandy Loam": 13,
  "Black Cotton": 20, "Deccan Black": 20, "Medium Black": 19,
  "Coastal Alluvial": 15, "Deltaic Alluvial": 15, "Gangetic Alluvial": 15, "Alluvial Loam": 15,
};

export function wiltThreshold(soilClass: string): number {
  return WILT_THRESHOLD[soilClass] ?? 14;
}

// ============================================================
// Advisory builder — shared by live fetch AND fallback estimate
// ============================================================
function buildAdvisories(input: {
  rootZone: number;
  projection: TwinProjectionPoint[];
  rain7: number[];
  tempMax: number;
  humidity: number;
  airTemp: number;
  soilClass: string;
  stateName: string;
  soil: StateSoil;
}): TwinAdvisory[] {
  const { rootZone, projection, rain7, tempMax, humidity, airTemp, soilClass, stateName, soil } = input;
  const advisories: TwinAdvisory[] = [];
  const wilting = wiltThreshold(soilClass);

  // Irrigation
  const dryDay = projection.findIndex((p) => p.moisture < wilting);
  if (dryDay === -1) {
    advisories.push({
      type: "irrigation",
      title: "No irrigation needed this week",
      body: `Root-zone moisture (${rootZone.toFixed(0)}%) stays above the ${wilting}% wilting line for your ${soilClass} soil all 7 days. Rain and current reserves are enough.`,
      severity: "good",
    });
  } else {
    const dayName = dryDay === 0 ? "tomorrow" : `in ${dryDay + 1} days`;
    const totalRain = rain7.slice(0, dryDay + 1).reduce((a, b) => a + b, 0);
    advisories.push({
      type: "irrigation",
      title: totalRain > 25 ? "Heavy rain coming — delay irrigation" : `Irrigate ${dayName}`,
      body:
        totalRain > 25
          ? `${totalRain.toFixed(0)} mm rain is forecast before moisture reaches the ${wilting}% wilting line — let the rain do the work and skip this cycle.`
          : `Model projects root-zone moisture hits the ${wilting}% wilting line ${dayName}. Apply ~25 mm (1 inch) of water to stay above it.`,
      severity: totalRain > 25 ? "good" : "caution",
    });
  }

  // Yield outlook
  const weekAvgMoisture = projection.reduce((a, p) => a + p.moisture, 0) / Math.max(1, projection.length);
  let yieldPct = 100;
  if (weekAvgMoisture < wilting + 4) yieldPct -= 15;
  if (weekAvgMoisture < wilting) yieldPct -= 12;
  if (tempMax > 38) yieldPct -= 8;
  if (rain7.slice(0, 7).reduce((a, b) => a + b, 0) > 150) yieldPct -= 10; // waterlogging
  yieldPct = Math.max(55, yieldPct);
  const yieldLabel = yieldPct >= 95 ? "Good" : yieldPct >= 80 ? "Average" : "At Risk";
  advisories.push({
    type: "yield",
    title: `Yield outlook: ${yieldLabel} (${yieldPct}% of potential)`,
    body:
      yieldPct >= 95
        ? `Moisture (${weekAvgMoisture.toFixed(0)}% avg) and temperature (${Math.round(tempMax)}°C peak) are in the healthy band. Keep the current schedule.`
        : `Root-zone moisture averages ${weekAvgMoisture.toFixed(0)}%${tempMax > 38 ? ` with ${Math.round(tempMax)}°C heat peaks` : ""}. Follow the irrigation advice above to recover ${100 - yieldPct}% of potential yield.`,
    severity: yieldPct >= 95 ? "good" : yieldPct >= 80 ? "caution" : "alert",
  });

  // Fertilizer (state dataset gaps)
  const gapN = soil.n < 90 ? "urea (46-0-0) top-up ~40 kg/acre" : null;
  const gapP = soil.p < 30 ? "single super phosphate ~25 kg/acre" : null;
  const gapK = soil.k < 25 ? "muriate of potash ~15 kg/acre" : null;
  const gaps = [gapN, gapP, gapK].filter(Boolean) as string[];
  advisories.push({
    type: "fertilizer",
    title: gaps.length ? `${gaps.length} nutrient gap${gaps.length > 1 ? "s" : ""} in ${stateName} soils` : `Soil nutrients look balanced for ${stateName}`,
    body: gaps.length
      ? `State soil data shows low ${gaps.join(", ")}. Apply before the next rain so nutrients wash into the root zone, and always verify with a Soil Health Card lab test.`
      : `State-level N-P-K values (N:${soil.n} P:${soil.p} K:${soil.k}) are adequate for this season's crop. Confirm with a Soil Health Card lab test for field-precise values.`,
    severity: gaps.length ? "caution" : "good",
  });

  // Pest risk (humidity + temp rules)
  let pestBody = "Conditions are not favorable for major pest outbreaks right now. Scout the field weekly anyway.";
  let pestSev: TwinAdvisory["severity"] = "good";
  let pestTitle = "Low pest pressure expected";
  if (humidity > 80 && airTemp >= 20 && airTemp <= 30) {
    pestTitle = "High humidity — fungal disease risk";
    pestBody = `${humidity}% humidity at ${Math.round(airTemp)}°C favors fungal diseases (blight, rust, blast). If rain is forecast, spray a preventive bio-fungicide (Trichoderma) before the rain, not after.`;
    pestSev = "alert";
  } else if (airTemp > 35 && humidity < 50) {
    pestTitle = "Hot dry spell — sucking pest risk";
    pestBody = "Heat stress attracts aphids, whitefly and thrips. Check leaf undersides in the morning and consider neem oil spray at 5ml/L.";
    pestSev = "caution";
  }
  advisories.push({ type: "pest", title: pestTitle, body: pestBody, severity: pestSev });

  return advisories;
}

// ============================================================
// Rate-limit resilience: cache + retry + fallback
// ============================================================
const CACHE_KEY = "km_twin_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedTwin { key: string; state: TwinState; at: number }

function readCache(key: string): TwinState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedTwin;
    if (c.key !== key) return null;
    if (Date.now() - c.at > CACHE_TTL_MS) return null;
    return c.state;
  } catch { return null; }
}

function writeCache(key: string, state: TwinState): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key, state, at: Date.now() } as CachedTwin)); } catch {}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJsonWithRetry(url: string): Promise<any> {
  let lastErr: any = null;
  // 3 attempts: immediate, +1.2s, +2.5s → ~4s worst case before falling back
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 1200 : 2500);
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Open-Meteo API ${res.status}`);
        continue; // retry
      }
      if (!res.ok) throw new Error(`Open-Meteo API ${res.status}`);
      return await res.json();
    } catch (e) {
      // Network errors also retry once more
      if (lastErr && String((e as Error)?.message || "").startsWith("Open-Meteo API 4")) throw e;
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Open-Meteo API unreachable");
}

// ============================================================
// Live fetch from Open-Meteo (soil moisture + ET0 + 7-day forecast)
// ============================================================
export async function fetchTwinState(
  lat: number,
  lon: number,
  state: string,
  district: string,
  field?: { name: string | null; areaAcres: number | null },
  opts?: { force?: boolean }
): Promise<TwinState> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (!opts?.force) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  try {
    const live = await fetchLiveTwin(lat, lon, state, district, field);
    writeCache(cacheKey, live);
    return live;
  } catch (err) {
    // Live data unavailable (rate-limited / offline) — return climate-based estimate
    console.warn("Digital twin: live fetch failed, using estimated model:", err);
    return buildEstimatedTwin(lat, lon, state, district, field);
  }
}

async function fetchLiveTwin(
  lat: number,
  lon: number,
  state: string,
  district: string,
  field?: { name: string | null; areaAcres: number | null }
): Promise<TwinState> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation` +
    `&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_temperature_0_to_7cm` +
    `&daily=precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max` +
    `&forecast_days=7&timezone=auto`;

  const data = await fetchJsonWithRetry(url);

  const h = data.hourly;
  const cur = data.current;
  const daily = data.daily;

  const toPct = (v: number) => Math.round(v * 1000) / 10; // 0.35 → 35.0%
  const avg = (arr: number[] | undefined, take: number) => {
    if (!arr || arr.length === 0) return 0.3;
    const slice = arr.slice(0, take);
    return slice.reduce((a: number, b: number) => a + b, 0) / slice.length;
  };
  const m0to1 = toPct(avg(h?.soil_moisture_0_to_1cm, 24));
  const m1to3 = toPct(avg(h?.soil_moisture_1_to_3cm, 24));
  const m3to9 = toPct(avg(h?.soil_moisture_3_to_9cm, 24));
  const m9to27 = toPct(avg(h?.soil_moisture_9_to_27cm, 24));
  const rootZone = Math.round(((m1to3 + m3to9) / 2) * 10) / 10;

  const rain7: number[] = (daily?.precipitation_sum ?? []).map((v: number) => v ?? 0);
  const et07: number[] = (daily?.et0_fao_evapotranspiration ?? []).map((v: number) => v ?? 3);

  const soil = getStateSoil(state);
  const season = currentSeason();
  const projection = projectMoisture(rootZone, rain7, et07, 1.0);
  const crops = scoreCrops(soil.ph, rootZone, season);

  const humidity = Math.round(cur?.relative_humidity_2m ?? 60);
  const airTemp = Math.round(cur?.temperature_2m ?? 28);
  const tempMax = Math.max(...(daily?.temperature_2m_max?.filter((v: number) => typeof v === "number") ?? [30]));

  const advisories = buildAdvisories({
    rootZone, projection, rain7, tempMax, humidity, airTemp,
    soilClass: soil.class, stateName: state, soil,
  });

  return {
    lat, lon, state, district,
    fieldName: field?.name ?? null,
    areaAcres: field?.areaAcres ?? null,
    airTemp,
    humidity,
    rainToday: Math.round((cur?.precipitation ?? 0) * 10) / 10,
    et0: Math.round((et07[0] ?? 3) * 100) / 100,
    moisture0to1: m0to1, moisture1to3: m1to3, moisture3to9: m3to9, moisture9to27: m9to27,
    soilTemp0to7: Math.round((h?.soil_temperature_0_to_7cm?.[0] ?? 25) * 10) / 10,
    ph: soil.ph, nitrogen: soil.n, phosphorus: soil.p, potassium: soil.k,
    soilClass: soil.class,
    projection, advisories, crops,
    fetchedAt: new Date().toISOString(),
    isEstimated: false,
  };
}

// ============================================================
// Climate-based fallback estimate (used only when Open-Meteo is down/rate-limited)
// Deterministic per location + day so it doesn't flicker between renders.
// ============================================================
function seedRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildEstimatedTwin(
  lat: number,
  lon: number,
  state: string,
  district: string,
  field?: { name: string | null; areaAcres: number | null }
): TwinState {
  const soil = getStateSoil(state);
  const now = new Date();
  const daySeed = Math.floor(now.getTime() / 86400000);
  const season = currentSeason();
  const m = now.getMonth() + 1;
  const monsoon = m >= 6 && m <= 9; // Jun–Sep

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // Root-zone base: wetter in monsoon, drier in winter; deterministic variation
  const rootZone = Math.round(
    ((monsoon ? 30 + seedRand(lat + daySeed) * 8 : 20 + seedRand(lon + daySeed) * 6)) * 10
  ) / 10;
  const m0to1 = Math.round(clamp(rootZone + (monsoon ? 6 : -4) + seedRand(daySeed + 1) * 3, 6, 46) * 10) / 10;
  const m1to3 = rootZone;
  const m3to9 = Math.round(clamp(rootZone + 2 - seedRand(daySeed + 2) * 3, 6, 46) * 10) / 10;
  const m9to27 = Math.round(clamp(rootZone + 4 - seedRand(daySeed + 3) * 2, 8, 46) * 10) / 10;

  const et0 = monsoon ? 3.2 : 4.5;
  const rain7 = Array.from({ length: 7 }, (_, i) => {
    if (monsoon) return seedRand(daySeed + i * 7) > 0.55 ? Math.round(4 + seedRand(i + daySeed) * 18) : 0;
    return seedRand(daySeed + i + 50) > 0.85 ? 2 : 0;
  });

  const projection = projectMoisture(rootZone, rain7, Array(7).fill(et0));
  const crops = scoreCrops(soil.ph, rootZone, season);

  const humidity = monsoon ? 82 : 45;
  const airTemp = monsoon ? 29 : 31;
  const tempMax = monsoon ? 34 : 38;

  const advisories = buildAdvisories({
    rootZone, projection, rain7, tempMax, humidity, airTemp,
    soilClass: soil.class, stateName: state, soil,
  });

  return {
    lat, lon, state, district,
    fieldName: field?.name ?? null,
    areaAcres: field?.areaAcres ?? null,
    airTemp, humidity,
    rainToday: Math.round((rain7[0] ?? 0) * 10) / 10,
    et0,
    moisture0to1: m0to1, moisture1to3: m1to3, moisture3to9: m3to9, moisture9to27: m9to27,
    soilTemp0to7: Math.round((monsoon ? 27 + seedRand(daySeed + 4) * 2 : 22 + seedRand(daySeed + 4) * 3) * 10) / 10,
    ph: soil.ph, nitrogen: soil.n, phosphorus: soil.p, potassium: soil.k,
    soilClass: soil.class,
    projection, advisories, crops,
    fetchedAt: new Date().toISOString(),
    isEstimated: true,
  };
}

// ---- Field storage (shared with Field Mapping page) ----
const FIELD_KEY = "km_digital_twin_field";

export interface TwinField {
  name: string;
  areaAcres: number;
  centroid: { lat: number; lng: number };
  savedAt: string;
}

export function saveTwinField(f: TwinField): void {
  try { localStorage.setItem(FIELD_KEY, JSON.stringify(f)); } catch {}
}

export function loadTwinField(): TwinField | null {
  try {
    const raw = localStorage.getItem(FIELD_KEY);
    return raw ? (JSON.parse(raw) as TwinField) : null;
  } catch { return null; }
}
