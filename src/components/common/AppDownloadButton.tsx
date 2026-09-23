import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

// ============================================================
// Android app download button — lives in the navbar right
// cluster (Subscribe -> Download App -> Settings).
// 1. If a GitHub Release on Amanyadavv007/KrishiMitra has an
//    .apk asset, it is served directly — always up to date.
// 2. Otherwise the bundled placeholder in /downloads is used.
// Single tap starts the download immediately (hidden iframe,
// no navigation, no new tab).
// ============================================================
const GITHUB_REPO = "Amanyadavv007/KrishiMitra";
const FALLBACK_URL = "/downloads/KrishiMitra.apk";

function triggerDownload(url: string) {
  // Hidden iframe forces the download without navigating away.
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.src = url;
  document.body.appendChild(frame);
  setTimeout(() => frame.remove(), 60_000);
}

export default function AppDownloadButton() {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    let url = FALLBACK_URL;
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (res.ok) {
        const rel = await res.json();
        const asset = (rel.assets || []).find((a: { name: string }) =>
          /\.apk$/i.test(a.name)
        );
        if (asset?.browser_download_url) url = asset.browser_download_url;
      }
    } catch {
      /* offline or rate-limited -> fallback */
    }
    triggerDownload(url);
    setBusy(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title="Download the KrishiMitra Android app"
      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 transition-colors active:scale-95 disabled:opacity-70 cursor-pointer"
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span className="hidden md:inline">Download App</span>
      <span className="hidden sm:inline md:hidden">App</span>
    </button>
  );
}
