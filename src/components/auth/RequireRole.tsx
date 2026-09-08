import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface RequireRoleProps {
  role: "FARMER" | "DEALER" | "ADMIN" | "CUSTOMER";
  children: React.ReactNode;
}

/**
 * Route guard for role-specific areas.
 * - Not logged in  → login page pre-tagged with the right role (+ returnTo)
 * - Wrong role     → bounced to that user's own home (/merchant or /dashboard)
 */
export default function RequireRole({ role, children }: RequireRoleProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    const as = role === "DEALER" ? "merchant" : role === "CUSTOMER" ? "customer" : "farmer";
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?as=${as}&returnTo=${returnTo}`} replace />;
  }

  if (user.role !== role && user.role !== "ADMIN") {
    const home =
      user.role === "DEALER" ? "/merchant"
      : user.role === "CUSTOMER" ? "/customer"
      : "/dashboard";
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
