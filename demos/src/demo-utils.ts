import { MapOptions, type SdkConfig } from "@maptiler/sdk";
import Stats from "stats.js";
/**
 * Adds performance statistics to the page.
 */
export function addPerformanceStats() {
  const stats = new Stats();
  stats.dom.style.top = "unset";
  stats.dom.style.bottom = "0";
  document.body.appendChild(stats.dom);

  requestAnimationFrame(function loop() {
    stats.update();
    requestAnimationFrame(loop);
  });
}

/**
 * Configures the MapTiler API key for the SDK, from the first of:
 * - `VITE_MAPTILER_API_KEY` in `.env.local` at the root of the repo, also stored in the browser if no key is yet
 * - the key stored in the browser
 * - the `key` URL parameter, also stored in the browser
 */
export function setupMapTilerApiKey({ config }: { config: SdkConfig }) {
  // Not typed through `vite/client`, as its global declarations would change how `src` type-checks
  const envApiKey = (import.meta as ImportMeta & { env: { VITE_MAPTILER_API_KEY?: string } }).env.VITE_MAPTILER_API_KEY;
  if (envApiKey && !localStorage.getItem("MT_DEMO_API_KEY")) {
    localStorage.setItem("MT_DEMO_API_KEY", envApiKey);
  }

  config.apiKey = envApiKey ?? localStorage.getItem("MT_DEMO_API_KEY") ?? "API_KEY";

  if (config.apiKey === "API_KEY") {
    const urlParams = new URLSearchParams(window.location.search);
    const apiKey = urlParams.get("key");
    if (apiKey) {
      config.apiKey = apiKey;
      localStorage.setItem("MT_DEMO_API_KEY", apiKey);
    } else {
      const errorMessage =
        "MapTiler API key is missing. Please set `VITE_MAPTILER_API_KEY` in `.env.local` at the root of the repo, or use URL `key` parameter to set it (`?key=XXXXX`).";
      alert(errorMessage);
      throw new Error(errorMessage);
    }
  }
}
