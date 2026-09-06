import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Sprout, User, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import LanguageSelector from "../common/LanguageSelector";
import NotificationBell from "../common/NotificationBell";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: null },
  { to: "/analyze", label: "Crop Checkup", icon: null },
  { to: "/weather", label: "Weather", icon: null },
  { to: "/products", label: "Store", icon: null },
  { to: "/dealers", label: "Dealers", icon: null },
  { to: "/mandi-prices", label: "Mandi Prices", icon: null },
  { to: "/marketplace", label: "Marketplace", icon: null },
  { to: "/supply-chain", label: "Track Parcel", icon: null },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [aiMenuOpen, setAiMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* LEFT: Logo — pinned to far left */}
          <Link
            to="/"
            className="flex items-center gap-2.5 shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 leading-none">AgriNexus</span>
              <span className="block text-[9px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">Smart Agriculture</span>
            </div>
          </Link>

          {/* CENTER: Nav links — equal spacing, single line, proper width */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <Link
                to="/inventory"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors whitespace-nowrap"
              >
                {user ? "Crop Stock" : "Crop Stock"}
              </Link>
            )}

            {/* AI Seva dropdown */}
            <div className="relative">
              <button
                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                className="flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>AI Services</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {aiMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAiMenuOpen(false)} />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 rounded-2xl bg-white shadow-xl border border-slate-200/80 p-2 z-50 space-y-1">
                    <Link
                      to="/digital-twin"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-emerald-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Khet Ka Naksha (Digital Twin)</span>
                      <span className="text-[11px] text-slate-500">Real-time virtual farm replica</span>
                    </Link>
                    <Link
                      to="/consensus-engine"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-violet-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">AI Salahkar (Consensus Engine)</span>
                      <span className="text-[11px] text-slate-500">Multi-agent AI advisory</span>
                    </Link>
                    <Link
                      to="/what-if-simulation"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-amber-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Kya Hoga Agar (What-If Sim)</span>
                      <span className="text-[11px] text-slate-500">Predictive crop simulator</span>
                    </Link>
                    <Link
                      to="/agronomy-rag"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-teal-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Fasal Salah (Agronomy RAG)</span>
                      <span className="text-[11px] text-slate-500">ICAR/FAO-grounded advisory</span>
                    </Link>
                    <Link
                      to="/field-mapping"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-blue-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">Khet Ki Naksha (GIS Mapping)</span>
                      <span className="text-[11px] text-slate-500">Draw & measure farm boundaries</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* RIGHT: Language, notifications, login/profile */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSelector />
            <NotificationBell />
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-xs font-semibold text-slate-700"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline truncate max-w-[100px]">{user.name}</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-red-600 cursor-pointer"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors border border-slate-200 whitespace-nowrap"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
