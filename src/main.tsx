import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./map.css";
import "./dossier.css";
import "./panels.css";
import "./compare.css";
import "./filter.css";
import "./settings.css";
import "./radar.css";
import "./evidence.css";
import "./states.css";
import { installGlobalErrorBoundary } from "./services/errors";
import { track } from "./services/analytics";
import { initTheme } from "./utils/theme";

initTheme();
installGlobalErrorBoundary();
track("app_opened");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Reload once when a new service worker takes over, so users never stay on a stale build.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.update().catch(() => undefined))
      .catch(() => { /* App remains fully usable without SW. */ });
  });
}

try { console.info("[Plot Scout] build", __BUILD_ID__, "plan PRO"); } catch { /* noop */ }
