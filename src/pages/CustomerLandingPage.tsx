import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, HeartHandshake, Package, Star, MapPin, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { fetchMarketplace, type MarketProduct } from "../lib/customerData";
import { useLocation } from "../contexts/LocationContext";

/**
 * Customer landing page (/shop) — the customer's home inside the app.
 * Same warm agricultural theme as the farmer/merchant worlds, but the
 * content is all about buying fresh produce directly from farmers.
 */
export default function CustomerLandingPage() {
  const { user } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const loc = useLocation();
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchMarketplace(loc.city || "")
      .then((p) => alive && setProducts(p))
      .catch(() => alive && setProducts([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [loc.city]);

  const featured = products.slice(0, 8);
  const farmers = new Map<string, { name: string; rating: number; city: string; products: number }>();
  products.forEach((p) => {
    if (!farmers.has(p.listing.id)) {
      farmers.set(p.listing.id, {
        name: p.listing.name,
        rating: p.listing.rating,
        city: p.listing.city || p.listing.village,
        products: 1,
      });
    } else {
      farmers.get(p.listing.id)!.products += 1;
    }
  });
  const topFarmers = [...farmers.values()].sort((a, b) => b.rating - a.rating).slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-700 text-[11px] font-bold tracking-wide shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              FARM-TO-HOME MARKETPLACE
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Namaste{user?.name ? `, ${user.name}` : ""}! 👋
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              Buy fresh vegetables, fruits, honey, pickles and more — directly from
              farmers near you. No middlemen, fair prices, farm-fresh quality.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/shop/marketplace")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-md shadow-amber-200 cursor-pointer transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                Browse Marketplace
              </button>
              <button
                onClick={() => navigate("/shop/farmers")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold cursor-pointer transition-colors"
              >
                <HeartHandshake className="w-4 h-4" />
                Meet Your Farmers
              </button>
            </div>
            {totalItems > 0 && (
              <p className="mt-3 text-xs text-amber-700 font-semibold">
                🛒 {totalItems} item{totalItems > 1 ? "s" : ""} waiting in your cart —{" "}
                <button onClick={() => navigate("/shop/orders")} className="underline cursor-pointer">
                  go to cart
                </button>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-slate-900">Fresh Near You</h2>
          <Link to="/shop/marketplace" className="text-xs font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-white border border-slate-200/80 animate-pulse" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200/80 text-center text-sm text-slate-500">
            No products listed near you yet — check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((p) => (
              <Link
                key={p.id}
                to="/shop/marketplace"
                className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:border-amber-200 transition-all"
              >
                <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-amber-50 to-emerald-50 flex items-center justify-center text-4xl mb-3">
                  {p.emoji}
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors truncate">
                  {p.productName}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">👨‍🌾 {p.listing.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-extrabold text-slate-900">₹{p.pricePerKg}/{p.unitLabel === "kg" ? "kg" : "pack"}</span>
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-600">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {p.listing.rating}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Meet your farmers */}
      <section className="max-w-7xl mx-auto px-4 pb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-slate-900">Meet Your Farmers</h2>
          <Link to="/shop/farmers" className="text-xs font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1">
            Farmer Connect <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topFarmers.map((f, i) => (
            <Link
              key={i}
              to="/shop/farmers"
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                  {f.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{f.name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {f.city}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 text-[11px]">
                <span className="flex items-center gap-0.5 font-bold text-amber-600">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {f.rating}
                </span>
                <span className="text-slate-400">{f.products} products</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
