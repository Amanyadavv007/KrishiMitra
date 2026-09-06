import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Sprout, ChevronDown, Bell, Globe, Search, User } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/analyze", label: "Crop Checkup" },
  { to: "/weather", label: "Weather" },
  { to: "/products", label: "Store" },
  { to: "/dealers", label: "Dealers" },
  { to: "/mandi-prices", label: "Mandi Prices" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/supply-chain", label: "Track Parcel" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [aiMenuOpen, setAiMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">

          {/* ===== FAR LEFT: Logo (IBM-style) ===== */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-sm">
                <Sprout className="w-4.5 h-4.5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">AgriNexus</span>
            </Link>
            {/* vertical divider like IBM */}
            <div className="w-px h-6 bg-slate-300 mx-2" />
          </div>

          {/* ===== CENTER: Nav links ===== */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <Link
                to="/inventory"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors whitespace-nowrap"
              >
                Crop Stock
              </Link>
            )}

            {/* AI Services dropdown */}
            <div className="relative ml-1">
              <button
                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>AI Services</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {aiMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAiMenuOpen(false)} />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 rounded-2xl bg-white shadow-xl border border-slate-200/80 p-2 z-50 space-y-1">
                    <Link to="/digital-twin" onClick={() => setAiMenuOpen(false)} className="block p-2.5 rounded-xl hover:bg-emerald-50 text-xs transition-colors"><span className="font-bold text-slate-900 block">Khet Ka Naksha (Digital Twin)</span><span className="text-[11px] text-slate-500">Real-time virtual farm replica</span></Link>
                    <Link to="/consensus-engine" onClick={() => setAiMenuOpen(false)} className="block p-2.5 rounded-xl hover:bg-violet-50 text-xs transition-colors"><span className="font-bold text-slate-900 block">AI Salahkar (Consensus Engine)</span><span className="text-[11px] text-slate-500">Multi-agent AI advisory</span></Link>
                    <Link to="/what-if-simulation" onClick={() => setAiMenuOpen(false)} className="block p-2.5 rounded-xl hover:bg-amber-50 text-xs transition-colors"><span className="font-bold text-slate-900 block">Kya Hoga Agar (What-If Sim)</span><span className="text-[11px] text-slate-500">Predictive crop simulator</span></Link>
                    <Link to="/agronomy-rag" onClick={() => setAiMenuOpen(false)} className="block p-2.5 rounded-xl hover:bg-teal-50 text-xs transition-colors"><span className="font-bold text-slate-900 block">Fasal Salah (Agronomy RAG)</span><span className="text-[11px] text-slate-500">ICAR/FAO-grounded advisory</span></Link>
                    <Link to="/field-mapping" onClick={() => setAiMenuOpen(false)} className="block p-2.5 rounded-xl hover:bg-blue-50 text-xs transition-colors"><span className="font-bold text-slate-900 block">Khet Ki Naksha (GIS Mapping)</span><span className="text-[11px] text-slate-500">Draw & measure farm boundaries</span></Link>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* ===== FAR RIGHT: icons + login (IBM-style) ===== */}
          <div className="ml-auto flex items-center gap-1">
            <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer" title="Search">
              <Search className="w-4.5 h-4.5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer" title="Notifications">
              <Bell className="w-4.5 h-4.5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer" title="Language">
              <Globe className="w-4.5 h-4.5" />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            {user ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Log out"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{user.name}</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="ml-1 px-4 py-1.5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
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
