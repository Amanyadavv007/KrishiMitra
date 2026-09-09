import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.krishimitra.app",
  appName: "KrishiMitra",
  // Remote-load wrapper: the WebView loads the LIVE website, so the app
  // is always pixel-identical to the site and updates on every deploy.
  server: {
    // ?app=1 is a deterministic marker the site uses to switch to the
    // desktop viewport (index.html). The UA marker "KrishiMitraApp" set in
    // MainActivity is the belt-and-suspenders fallback after reloads.
    url: "https://krishimi.freebuff.app/?app=1",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0f5132",
  },
  // No webDir bundling needed for remote-load, but Capacitor requires it.
  webDir: "dist",
};

export default config;
