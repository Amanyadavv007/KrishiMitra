import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, MapPin, ArrowRight, BarChart3 } from "lucide-react";
import { useLocation } from "../contexts/LocationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { saveMandiSnapshot, fetchMandiHistory, todayStr } from "../lib/supabaseData";
import { MANDI_LOCATIONS } from "../lib/mandiData";


export const TOP_CROPS = ["Wheat", "Paddy", "Tomato", "Mustard", "Potato"];

export interface MandiPriceData {
  mandi: string;
  district: string;
  state: string;
  crop: string;
  price: number;
  change: number;
  changePercent: number;
  history: number[];
}

function generatePrice(base: number, seed: number): { price: number; change: number; changePercent: number; history: number[] } {
  const variation = Math.floor(((seed * 7 + 13) % 300) - 100);
  const price = Math.max(base + variation, 500);
  const change = Math.floor(((seed * 3 + 7) % 160) - 60);
  const changePercent = Math.round((change / price) * 100 * 10) / 10;
  const history = Array.from({ length: 7 }, (_, i) => {
    return price + Math.floor(((seed + i * 11) % 80) - 40);
  });
  return { price, change, changePercent, history };
}

export function getNearbyMandis(state: string, city: string): MandiPriceData[] {
  const stateLocs = MANDI_LOCATIONS.filter((l) => l.state === state);
  const cityLocs = MANDI_LOCATIONS.filter((l) => l.city === city);

  // Prefer city-level matches, then state-level
  const locs = cityLocs.length > 0 ? cityLocs.slice(0, 2) : stateLocs.slice(0, 3);
  if (locs.length === 0) {
    // Fallback to Delhi
    const delhi = MANDI_LOCATIONS.filter((l) => l.state === "Delhi").slice(0, 2);
    return delhi.flatMap((loc, li) =>
      loc.mandis.slice(0, 1).map((mandi, mi) => {
        const cropIdx = (li + mi) % TOP_CROPS.length;
        const crop = TOP_CROPS[cropIdx];
        const bases: Record<string, number> = { Wheat: 2200, Paddy: 2100, Tomato: 1800, Mustard: 5400, Potato: 1400 };
        const p = generatePrice(bases[crop] || 2000, li * 10 + mi);
        return { mandi, district: loc.district, state: loc.state, crop, ...p };
      })
    );
  }

  return locs.flatMap((loc, li) =>
    loc.mandis.slice(0, 2).map((mandi, mi) => {
      const cropIdx = (li + mi) % TOP_CROPS.length;
      const crop = TOP_CROPS[cropIdx];
      const bases: Record<string, number> = { Wheat: 2200, Paddy: 2100, Tomato: 1800, Mustard: 5400, Potato: 1400 };
      const p = generatePrice(bases[crop] || 2000, li * 10 + mi);
      return { mandi, district: loc.district, state: loc.state, crop, ...p };
    })
  );
}

// --- Mini sparkline SVG (no library needed) ---
function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 50;
  const height = 18;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MandiPricesBar() {
  const { state, city } = useLocation();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mandiData, setMandiData] = useState<MandiPriceData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMandiData = useCallback(() => {
    setLoading(true);
    const resolvedState = state || "Delhi";
    const resolvedCity = city || "Delhi";
    const data = getNearbyMandis(resolvedState, resolvedCity);
    // Only take first 2 mandis
    const shown = data.slice(0, 2);
    setMandiData(shown);
    setLoading(false);
    // Persist today's prices into the 14-day mandi price history database,
    // then upgrade the sparklines with real stored history when available.
    (async () => {
      try {
        await saveMandiSnapshot(
          shown.map((m) => ({
            mandi: m.mandi,
            district: m.district,
            state: m.state,
            crop: m.crop,
            price: m.price,
            unit: "quintal",
            price_date: todayStr(),
            change: m.change,
            change_percent: m.changePercent,
          }))
        );
        const hist = await fetchMandiHistory(14);
        setMandiData((prev) =>
          prev.map((m) => {
            const rows = hist
              .filter((r) => r.mandi === m.mandi && r.crop === m.crop)
              .sort((a, b) => a.price_date.localeCompare(b.price_date));
            return rows.length >= 2 ? { ...m, history: rows.map((r) => r.price) } : m;
          })
        );
      } catch {
        // DB not migrated yet — synthetic sparkline history still shown
      }
    })();
  }, [state, city]);

  useEffect(() => {
    fetchMandiData();
  }, [fetchMandiData]);

  if (loading || mandiData.length === 0) return null;

  // Always show "More" → opens /auth page (login/register)
  const handleMore = () => {
    navigate("/login?returnTo=/mandi-prices");
  };

  return (
    <div className="mt-4 relative z-10 space-y-2">
      {/* Two mandi price cards — always visible */}
      {mandiData.map((m, i) => (
        <div
          key={i}
          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3.5 py-2.5 flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-500/30 text-emerald-300 flex-shrink-0">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">
                <MapPin className="w-2.5 h-2.5 inline mr-0.5" />
                {m.mandi}
              </p>
              <p className="text-[10px] text-emerald-200">
                {m.crop} ₹{m.price.toLocaleString()}/q
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <MiniSparkline data={m.history} positive={m.change >= 0} />
            <div className="text-right">
              <p className={`text-[10px] font-bold flex items-center gap-0.5 justify-end ${m.change >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {m.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {m.change >= 0 ? "+" : ""}{m.changePercent}%
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* More button — always opens login page */}
      <button
        onClick={handleMore}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
      >
        {t("morePrices") || "More"}
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
