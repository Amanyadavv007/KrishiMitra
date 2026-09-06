import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sprout, User, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import LanguageSelector from "../common/LanguageSelector";
import NotificationBell from "../common/NotificationBell";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [aiMenuOpen, setAiMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900">AgriNexus</span>
              <span className="block text-[9px] font-semibold text-slate-400 tracking-wider uppercase">{t("smartAgriculture") || "Smart Agriculture"}</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            <Link to="/dashboard" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("dashboard")}
            </Link>
            <Link to="/analyze" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("cropCheckup")}
            </Link>
            <Link to="/weather" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("weather")}
            </Link>
            <Link to="/products" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("store")}
            </Link>
            <Link to="/dealers" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("dealers")}
            </Link>
            {user && (
              <Link to="/inventory" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
                {t("fasalStock")}
              </Link>
            )}
            <Link to="/mandi-prices" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("mandiBhaav")}
            </Link>
            <Link to="/marketplace" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("kisaanBazaar")}
            </Link>
            <Link to="/supply-chain" className="px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors">
              {t("maalKhed")}
            </Link>

            {/* AI Seva Dropdown */}
            <div className="relative">
              <button
                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors cursor-pointer"
              >
                <span>{t("aiSeva")}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {aiMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAiMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-slate-200/80 p-2 z-50 space-y-1">
                    <Link
                      to="/digital-twin"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-emerald-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">{t("khetKaNaksha")}</span>
                      <span className="text-[11px] text-slate-500">{t("khetKaNakshaDesc")}</span>
                    </Link>
                    <Link
                      to="/consensus-engine"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-violet-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">{t("aiSalahkar")}</span>
                      <span className="text-[11px] text-slate-500">{t("aiSalahkarDesc")}</span>
                    </Link>
                    <Link
                      to="/what-if-simulation"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-amber-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">{t("kyaHogaAgar")}</span>
                      <span className="text-[11px] text-slate-500">{t("kyaHogaAgarDesc")}</span>
                    </Link>
                    <Link
                      to="/agronomy-rag"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-teal-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">{t("fasalSalah")}</span>
                      <span className="text-[11px] text-slate-500">{t("fasalSalahDesc")}</span>
                    </Link>
                    <Link
                      to="/field-mapping"
                      onClick={() => setAiMenuOpen(false)}
                      className="block p-2.5 rounded-xl hover:bg-blue-50 text-xs transition-colors"
                    >
                      <span className="font-bold text-slate-900 block">{t("khetKiNaksha")}</span>
                      <span className="text-[11px] text-slate-500">{t("khetKiNakshaDesc")}</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2.5">
            <LanguageSelector />
            <NotificationBell />
            {user ? (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-xs font-semibold text-slate-700">
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline truncate max-w-[100px]">{user.name}</span>
                </Link>
                <button onClick={logout} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-red-600 cursor-pointer">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="px-4 py-2 rounded-xl text-xs font-bold text-slate-800 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors border border-slate-200">
                {t("login")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
