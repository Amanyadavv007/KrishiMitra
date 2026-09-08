import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation as useRouterLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LocationProvider } from "./contexts/LocationContext";
import { SocketProvider } from "./contexts/SocketContext";

import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import MobileNav from "./components/layout/MobileNav";
import LanguageOnboardingModal from "./components/common/LanguageOnboardingModal";
import RoleSelectModal from "./components/common/RoleSelectModal";
import MerchantNavbar from "./components/merchant/MerchantNavbar";
import RequireRole from "./components/auth/RequireRole";

// Landing page loads eagerly (first paint), everything else is code-split
// so each page downloads only its own JS — dramatically faster navigation.
import LandingPage from "./pages/LandingPage";

const FarmerDashboard = lazy(() => import("./pages/FarmerDashboard"));
const DealerDashboard = lazy(() => import("./pages/DealerDashboard"));
const AnalyzeCropPage = lazy(() => import("./pages/AnalyzeCropPage"));
const AnalysisDetailPage = lazy(() => import("./pages/AnalysisDetailPage"));
const CropHistoryPage = lazy(() => import("./pages/CropHistoryPage"));
const SoilAnalysisPage = lazy(() => import("./pages/SoilAnalysisPage"));
const WeatherPage = lazy(() => import("./pages/WeatherPage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const DealersPage = lazy(() => import("./pages/DealersPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const PostCropPage = lazy(() => import("./pages/PostCropPage"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const LearnPage = lazy(() => import("./pages/LearnPage"));
const FarmerProfilePage = lazy(() => import("./pages/FarmerProfilePage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const MerchantLandingPage = lazy(() => import("./pages/MerchantLandingPage"));
const MerchantSearchPage = lazy(() => import("./pages/MerchantSearchPage"));
const MerchantDashboardPage = lazy(() => import("./pages/MerchantDashboardPage"));
const MerchantComingSoon = lazy(() => import("./pages/MerchantComingSoon"));

// 5 New Advanced Agricultural Intelligence Pages
const DigitalTwinPage = lazy(() => import("./pages/DigitalTwinPage"));
const ConsensusEnginePage = lazy(() => import("./pages/ConsensusEnginePage"));
const WhatIfSimulationPage = lazy(() => import("./pages/WhatIfSimulationPage"));
const AgronomyRAGPage = lazy(() => import("./pages/AgronomyRAGPage"));
const FieldMappingPage = lazy(() => import("./pages/FieldMappingPage"));

// Pillar 2: Post-Harvest & Market Features
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const MandiPricePage = lazy(() => import("./pages/MandiPricePage"));
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));
const SupplyChainPage = lazy(() => import("./pages/SupplyChainPage"));

/**
 * Full-screen themed loading state shown while a lazy page chunk downloads.
 * Kept intentionally light so it renders instantly.
 */
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      <p className="text-xs font-semibold text-slate-400">Loading...</p>
    </div>
  );
}

/**
 * Warms up the browser cache for the pages a user is most likely to visit
 * next, during idle time. Runs once per session after the app is interactive.
 */
function usePreloadCoreRoutes() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // Farmer flow + auth pages are the highest-traffic destinations.
      void import("./pages/FarmerDashboard");
      void import("./pages/LoginPage");
      void import("./pages/WeatherPage");
      void import("./pages/MandiPricePage");
      void import("./pages/MerchantLandingPage");
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppShell() {
  const { user } = useAuth();
  const routerLocation = useRouterLocation();
  // Merchant area uses its own navbar; the farmer navbar/mobile nav is hidden there.
  const isMerchantArea = routerLocation.pathname.startsWith("/merchant");
  // Popups show on every visit while logged out (no persistence); once logged in, never again.
  const [langSelected, setLangSelected] = useState(false);
  const [roleSelected, setRoleSelected] = useState(false);
  const showLangModal = !user && !langSelected;
  const showRoleModal = !user && langSelected && !roleSelected;
  const onboardingOpen = !user && (!langSelected || !roleSelected);

  usePreloadCoreRoutes();

  return (
    <>
        <LanguageProvider>
          <LocationProvider>
            <SocketProvider>
              <div
                className={`flex flex-col min-h-screen bg-slate-50 text-slate-900 pb-16 lg:pb-0 selection:bg-emerald-500 selection:text-white transition-[filter] duration-300 ${
                  onboardingOpen ? "blur-onboarding" : ""
                }`}
              >
                {!isMerchantArea && <Navbar />}
                {isMerchantArea && <MerchantNavbar />}
                <main className="flex-1">
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Existing Features */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/dashboard" element={<FarmerDashboard />} />
                      <Route path="/dealer-dashboard" element={<DealerDashboard />} />
                      <Route path="/analyze" element={<AnalyzeCropPage />} />
                      <Route path="/analysis/:id" element={<AnalysisDetailPage />} />
                      <Route path="/history" element={<CropHistoryPage />} />
                      <Route path="/soil-analysis" element={<SoilAnalysisPage />} />
                      <Route path="/weather" element={<WeatherPage />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/dealers" element={<DealersPage />} />
                      <Route path="/chat" element={<ChatPage />} />
                      <Route path="/post-crop" element={<PostCropPage />} />
                      <Route path="/assistant" element={<AIAssistantPage />} />
                      <Route path="/learn" element={<LearnPage />} />
                      <Route path="/profile" element={<FarmerProfilePage />} />
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />

                      {/* Merchant World (role-guarded) */}
                      <Route
                        path="/merchant"
                        element={
                          <RequireRole role="DEALER">
                            <MerchantLandingPage />
                          </RequireRole>
                        }
                      />
                      <Route
                        path="/merchant/search"
                        element={
                          <RequireRole role="DEALER">
                            <MerchantSearchPage />
                          </RequireRole>
                        }
                      />
                      <Route
                        path="/merchant/dashboard"
                        element={
                          <RequireRole role="DEALER">
                            <MerchantDashboardPage />
                          </RequireRole>
                        }
                      />
                      <Route
                        path="/merchant/contacts"
                        element={
                          <RequireRole role="DEALER">
                            <MerchantComingSoon
                              title="B2B Contacts"
                              description="Direct call and WhatsApp contacts of every registered farmer near your location."
                            />
                          </RequireRole>
                        }
                      />

                      {/* 5 Advanced AI Engines */}
                      <Route path="/digital-twin" element={<DigitalTwinPage />} />
                      <Route path="/consensus-engine" element={<ConsensusEnginePage />} />
                      <Route path="/what-if-simulation" element={<WhatIfSimulationPage />} />
                      <Route path="/agronomy-rag" element={<AgronomyRAGPage />} />
                      <Route path="/field-mapping" element={<FieldMappingPage />} />

                      {/* Pillar 2: Post-Harvest & Market */}
                      <Route path="/inventory" element={<InventoryPage />} />
                      <Route path="/mandi-prices" element={<MandiPricePage />} />
                      <Route path="/marketplace" element={<MarketplacePage />} />
                      <Route path="/supply-chain" element={<SupplyChainPage />} />
                    </Routes>
                  </Suspense>
                </main>                <Footer />
                {!isMerchantArea && <MobileNav />}
              </div>
              <LanguageOnboardingModal
                open={showLangModal}
                onSelect={() => setLangSelected(true)}
              />
              <RoleSelectModal
                open={showRoleModal}
                onSelect={() => setRoleSelected(true)}
              />
            </SocketProvider>
          </LocationProvider>
        </LanguageProvider>
    </>
  );
}
