import { useEffect, useRef, useState } from "react";

const TONE_COLOR: Record<string, string> = {
  good: "var(--good)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  neutral: "var(--text-dim)"
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * animate: opt-in only. When true, the ring sweeps and the number counts up
 * from 0 on first mount (e.g. Decision Room reveal). Default (unset) renders
 * at final value immediately — used everywhere else (property rows, hero
 * tiles) so lists don't replay this on every scroll/re-render.
 */
export function ScoreRing({ value, tone, size = 44, strokeWidth = 4, animate = false }: { value: number; tone: "good" | "warn" | "bad" | "neutral"; size?: number; strokeWidth?: number; animate?: boolean }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const reduced = prefersReducedMotion();
  const [display, setDisplay] = useState(animate && !reduced ? 0 : value);
  const raf = useRef<number>();

  useEffect(() => {
    if (!animate || reduced) { setDisplay(value); return; }
    const duration = 550;
    const start = performance.now();
    const from = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animate]);

  const pct = Math.max(0, Math.min(100, display));
  const offset = c - (pct / 100) * c;
  const color = TONE_COLOR[tone];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: animate ? "none" : "stroke-dashoffset .5s cubic-bezier(.4,0,.2,1)" }}
      />
      <text
        x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        fontSize={size * 0.32} fontWeight={700} fill="var(--text)" fontFamily="inherit"
      >
        {Math.round(display)}
      </text>
    </svg>
  );
}
