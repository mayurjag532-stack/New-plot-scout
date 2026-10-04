import { useState } from "react";
import { CapturedLocation } from "../types";
import { extractLatLngFromMapsUrl } from "../utils/geo";

type CaptureState = "idle" | "loading" | "success" | "error";

export default function LocationCapture({
  location,
  onCaptured
}: {
  location: CapturedLocation | null;
  onCaptured: (loc: CapturedLocation) => void;
}) {
  const [state, setState] = useState<CaptureState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showFallback, setShowFallback] = useState(false);
  const [mapsUrlInput, setMapsUrlInput] = useState("");

  function capture() {
    if (!("geolocation" in navigator)) {
      setState("error");
      setErrorMsg("This browser does not support GPS location. Use the 'paste Google Maps link' fallback below.");
      setShowFallback(true);
      return;
    }
    setState("loading");
    setErrorMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState("success");
        onCaptured({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now(),
          source: "gps"
        });
      },
      (err) => {
        setState("error");
        setShowFallback(true);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg("Location permission denied. Enable location access for this site in your browser settings, then try again.");
        } else if (err.code === err.TIMEOUT) {
          setErrorMsg("GPS timed out. Go outdoors / near a window for a clearer signal and try again.");
        } else {
          setErrorMsg("Location unavailable right now. Try again, or paste a Google Maps link below.");
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function useMapsUrl() {
    const coords = extractLatLngFromMapsUrl(mapsUrlInput);
    if (!coords) {
      setErrorMsg("Could not read coordinates from that link. Open the pin in Google Maps, tap Share, and paste the full link here.");
      return;
    }
    onCaptured({
      lat: coords.lat,
      lng: coords.lng,
      accuracy: null,
      timestamp: Date.now(),
      source: "maps_url"
    });
    setState("success");
    setErrorMsg("");
  }

  return (
    <div className="bg-field-card border border-field-line rounded-xl p-4">
      <h3 className="text-field-text font-semibold text-[15px] tracking-tight mb-1">Capture Location</h3>
      <p className="text-field-muted text-sm mb-3">Stand on the plot before pressing this.</p>

      <button
        onClick={capture}
        disabled={state === "loading"}
        className="ps-btn-primary w-full disabled:opacity-60"
      >
        {state === "loading" ? "Getting GPS fix\u2026" : location ? "Recapture current location" : "Capture current location"}
      </button>

      {state === "loading" && (
        <p className="text-field-muted text-sm mt-3">Waiting for a high-accuracy fix. This can take a few seconds outdoors.</p>
      )}

      {location && (
        <div className="ps-capture-ok">
          <p className="text-field-good font-medium text-sm">Location saved</p>
          <p className="text-field-text text-sm font-mono mt-1">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
          {location.accuracy !== null && location.accuracy > 50 && (
            <p className="mt-2 text-field-warn text-xs">GPS accuracy is ±{Math.round(location.accuracy)} m. For a stronger site record, recapture outdoors when possible.</p>
          )}
          <p className="text-field-muted text-xs mt-1">
            Accuracy: {location.accuracy ? `\u00b1${Math.round(location.accuracy)} m` : "unknown (from pasted link)"} &middot; Source:{" "}
            {location.source === "gps" ? "Device GPS" : location.source === "maps_url" ? "Pasted Google Maps link" : "Manual"} &middot;{" "}
            {new Date(location.timestamp).toLocaleString()}
          </p>
        </div>
      )}

      {state === "error" && errorMsg && (
        <div className="mt-3 bg-field-bad/10 border border-field-bad/40 rounded-lg p-3">
          <p className="text-field-bad text-sm">{errorMsg}</p>
        </div>
      )}

      {(showFallback || (!location && state !== "loading")) && (
        <div className="mt-4 border-t border-field-line pt-3">
          <button
            className="text-field-accent text-sm underline"
            onClick={() => setShowFallback((s) => !s)}
          >
            {showFallback ? "Hide" : "GPS not working? Paste a Google Maps link instead"}
          </button>
          {showFallback && (
            <div className="mt-2 flex flex-col gap-2">
              <input
                value={mapsUrlInput}
                onChange={(e) => setMapsUrlInput(e.target.value)}
                placeholder="Paste Google Maps share link here"
                className="bg-field-panel border border-field-line rounded-lg px-3 py-2 text-field-text text-sm"
              />
              <button
                onClick={useMapsUrl}
                className="bg-field-panel border border-field-accent text-field-accent rounded-lg py-2 text-sm font-medium"
              >
                Use this link's location
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
