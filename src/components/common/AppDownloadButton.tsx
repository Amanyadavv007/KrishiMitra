import { useState } from "react";
import { Download, Smartphone, Loader2, ExternalLink } from "lucide-react";

// ============================================================
// Landing page Android download button (top-right of hero).
// 1. If a GitHub Release on Amanyadavv007/KrishiMitra has an
//    .apk asset, it is served directly — always up to date.
// 2. Otherwise the bundled placeholder in /downloads is used.
// No user interaction beyond a single tap: the download starts
// immediately (hidden iframe / anchor click, no new tab).
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
  const [openedReleases, setOpenedReleases] = useState(false);

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
    setOpenedReleases(!url.startsWith("http"));
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
      <button
        onClick={handleClick}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 backdrop-blur-md text-white font-semibold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-70 cursor-pointer"
        title="Download the KrishiMitra Android app"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>Download App</span>
      </button>
      {openedReleases && (
        <a
          href={`https://github.com/${GITHUB_REPO}/releases`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium text-emerald-100 hover:text-white transition-colors"
        >
          <Smartphone className="w-3 h-3" />
          Releases page
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
