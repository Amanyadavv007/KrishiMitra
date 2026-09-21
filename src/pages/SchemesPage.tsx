import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Landmark, CheckCircle2, XCircle, AlertCircle, ExternalLink, FileCheck2,
  FileWarning, UserPlus, Info, ChevronDown, ChevronUp, Sprout,
  ThumbsUp, ThumbsDown, Flag, ShieldCheck,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  SCHEMES, matchSchemes, assessDocuments, loadSchemes, loadFeedback, saveFeedback,
  type Scheme, type SchemeMatch, type DocStatus, type FarmerProfile,
} from "../lib/schemesData";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm ${className}`}>{children}</div>
  );
}

/** Phase 2: have/missing checklist with profile links for fixable docs */
function DocumentChecklist({ docs }: { docs: DocStatus[] }) {
  const [open, setOpen] = useState(false);
  const haveCount = docs.filter((d) => d.have).length;
  const allHave = haveCount === docs.length;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          {allHave ? (
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <FileWarning className="w-3.5 h-3.5 text-amber-500" />
          )}
          Documents: {haveCount}/{docs.length} ready
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <ul className="mt-2.5 space-y-2">
          {docs.map((d) => (
            <li key={d.doc} className="flex items-start gap-2 text-xs">
              {d.have ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-px" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-px" />
              )}
              <div className="min-w-0">
                <p className={`font-semibold leading-snug ${d.have ? "text-slate-700" : "text-slate-800"}`}>
                  {d.doc} {d.have ? "— ready" : "— missing"}
                </p>
                {!d.have && d.fixPath && (
                  <Link
                    to={d.fixPath}
                    className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    <UserPlus className="w-3 h-3" /> {d.fixLabel} →
                  </Link>
                )}
                {!d.have && !d.fixPath && d.fixLabel && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{d.fixLabel}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Phase 4: "received benefits?" question — optional, skippable (answer is never required) */
function BenefitsQuestion({ schemeId, farmerId }: { schemeId: string; farmerId: string }) {
  const [value, setValue] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadFeedback(farmerId).then((fb) => {
      if (alive && fb[schemeId]) setValue(fb[schemeId].received_benefits);
    });
    return () => {
      alive = false;
    };
  }, [schemeId, farmerId]);

  if (dismissed) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold text-slate-500">Did you receive benefits from this scheme?</span>
      {value !== null && (
        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> saved
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <button
          onClick={async () => {
            setValue(true);
            await saveFeedback(farmerId, schemeId, { received_benefits: true });
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
            value === true
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
          }`}
        >
          <ThumbsUp className="w-3 h-3" /> Yes
        </button>
        <button
          onClick={async () => {
            setValue(false);
            await saveFeedback(farmerId, schemeId, { received_benefits: false });
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
            value === false
              ? "bg-amber-500 border-amber-500 text-white"
              : "bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700"
          }`}
        >
          <ThumbsDown className="w-3 h-3" /> No
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold px-1 cursor-pointer"
        >
          skip
        </button>
      </div>
    </div>
  );
}

/** Phase 5: "applied but got no response" — data logging only, no follow-up promises */
function NoResponseReport({ schemeId, farmerId }: { schemeId: string; farmerId: string }) {
  const [reported, setReported] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    loadFeedback(farmerId).then((fb) => {
      if (alive && fb[schemeId]?.applied_no_response) setReported(true);
    });
    return () => {
      alive = false;
    };
  }, [schemeId, farmerId]);

  if (reported) {
    return (
      <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
        <Flag className="w-3 h-3 text-slate-300" />
        Report logged. We don't track applications — this only feeds the anonymous gap statistics.
      </p>
    );
  }
  if (!confirming) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => setConfirming(true)}
          className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Flag className="w-3 h-3" /> Applied but got no response? Report it
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-slate-500">Log this report? It only adds to anonymous counts.</span>
      <button
        onClick={async () => {
          await saveFeedback(farmerId, schemeId, { applied_no_response: true });
          setReported(true);
          setConfirming(false);
        }}
        className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 cursor-pointer"
      >
        Yes, log it
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
      >
        cancel
      </button>
    </div>
  );
}

function SchemeCard({
  m, profile, farmerId,
}: {
  m: SchemeMatch;
  profile: FarmerProfile;
  farmerId: string;
}) {
  const { scheme } = m;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">{scheme.scheme_name}</h3>
            {scheme.category === "state" ? (
              <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-100">
                UP State Scheme
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                Central Scheme
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{scheme.hindi_name}</p>
        </div>
        <span
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
            m.eligible
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-50 text-slate-500 border-slate-200"
          }`}
        >
          {m.eligible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {m.eligible ? "You qualify" : "Check status"}
        </span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed mt-2">{scheme.description}</p>
      <p className="text-[11px] font-bold text-emerald-700 mt-1.5">🎁 {scheme.benefit_summary}</p>

      {/* Plain-language reasons / blockers */}
      <div className="mt-3 space-y-1.5">
        {m.eligible ? (
          m.reasons.map((r, i) => (
            <p key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-px" />
              <span>{r}</span>
            </p>
          ))
        ) : (
          m.blockers.map((b, i) => (
            <p key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-px" />
              <span>{b}</span>
            </p>
          ))
        )}
      </div>

      {m.eligible && (
        <>
          <DocumentChecklist docs={assessDocuments(profile, m.scheme)} />
          <BenefitsQuestion schemeId={m.scheme.id} farmerId={farmerId} />
          <NoResponseReport schemeId={m.scheme.id} farmerId={farmerId} />
        </>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <a
          href={scheme.official_apply_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
        >
          Apply on official portal <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <span className="text-[9px] text-slate-400">Apply free — never pay an agent</span>
      </div>
    </Card>
  );
}

export default function SchemesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<Scheme[]>(SCHEMES);
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    loadSchemes().then((s) => {
      if (s.length > 0) setSchemes(s);
    });
  }, []);

  // ---- Evaluation input: real profile when available, test profile otherwise ----
  const profile = useMemo(() => {
    if (!user) return null;
    return {
      state: user.state || "",
      district: user.district || "",
      age: (user as any).age ?? null,
      land_acres: (user as any).land_acres ?? null,
      crop_type: (user as any).crop_type ?? null,
      annual_income_inr: (user as any).annual_income_inr ?? null,
      aadhaar_linked: (user as any).aadhaar_linked ?? false,
      bank_account_linked: (user as any).bank_account_linked ?? false,
      land_records_uploaded: (user as any).land_records_uploaded ?? false,
      is_income_tax_payer: (user as any).is_income_tax_payer ?? false,
    };
  }, [user]);

  // Incomplete-profile fallback: still run the engine on a demo profile so the
  // page is never empty, clearly labelled as a sample.
  const isDemo = !user || !user.state || (user as any).land_acres == null;
  const evalProfile = profile || {
    state: "Uttar Pradesh",
    district: "Lucknow",
    age: 35,
    land_acres: 1.5,
    crop_type: "Wheat",
    aadhaar_linked: false,
    bank_account_linked: false,
    land_records_uploaded: false,
    is_income_tax_payer: false,
  };

  const result = useMemo(() => matchSchemes(evalProfile, schemes), [evalProfile, schemes]);

  return (
    <div className="min-h-[80vh] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto">
            <Landmark className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Government Schemes — matched to your farm</h1>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            We check every major scheme against your profile with its real, official eligibility rules. No agents, no middlemen — apply free on government portals.
          </p>
        </div>

        {/* Profile summary strip */}
        {user && (
          <Card className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-600" /> Checking against:
            </span>
            <span className="text-slate-600">
              State: <b>{user.state || "—"}</b>
            </span>
            <span className="text-slate-600">
              Land: <b>{(user as any).land_acres != null ? `${(user as any).land_acres} acres` : "not set"}</b>
            </span>
            <span className="text-slate-600">
              Crop: <b>{(user as any).crop_type || "not set"}</b>
            </span>
            <Link to="/profile" className="text-emerald-600 font-bold hover:underline ml-auto">
              Update profile →
            </Link>
          </Card>
        )}

        {/* Incomplete-profile notice (existing card stays on dashboard as fallback) */}
        {isDemo && user && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Your profile is missing land / crop details, so this list uses a sample UP farmer as an example.
              {" "}
              <Link to="/profile" className="font-bold underline">Complete your profile</Link> for a personalized match.
            </p>
          </div>
        )}
        {!user && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 leading-relaxed">
              You're browsing as a guest — showing matches for a sample UP farmer (2 acres, wheat).
              {" "}
              <button onClick={() => navigate("/login")} className="font-bold underline cursor-pointer">Log in</button> to see your own matches.
            </p>
          </div>
        )}

        {/* Matched schemes */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Matched for you ({result.matched.length})
          </h2>
          {result.matched.map((m) => (
            <SchemeCard key={m.scheme.id} m={m} profile={evalProfile} farmerId={user?.id || ""} />
          ))}
          {result.matched.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-sm text-slate-500">
                No schemes matched yet — complete your profile (land size, crop, state) to unlock matches.
              </p>
            </Card>
          )}
        </div>

        {/* Excluded schemes — honest, with reasons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => setShowExcluded(!showExcluded)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-slate-400" />
              {result.excluded.length} scheme{result.excluded.length !== 1 ? "s" : ""} you don't currently qualify for — see why
            </span>
            {showExcluded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showExcluded &&
            result.excluded.map((m) => (
              <SchemeCard key={m.scheme.id} m={m} profile={evalProfile} farmerId={user?.id || ""} />
            ))}
        </div>

        <Link
          to="/schemes/gap-insights"
          className="block text-center text-xs font-bold text-indigo-600 hover:underline pt-2"
        >
          See how many eligible farmers actually receive benefits →
        </Link>
      </div>
    </div>
  );
}
