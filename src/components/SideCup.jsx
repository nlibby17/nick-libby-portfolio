import { useEffect, useRef } from "react";
import {
  COLS,
  ROWS,
  CELL_ASPECT,
  RAMP,
  IVORY,
  SPIN_MS,
  renderFrame,
} from "../lib/cupGeometry.js";

/*
  SideCup: the hero cup redeployed as a page ornament for
  the Dunkin project page (Nick, Oct 25, 2026). A mirrored
  pair flanks the top of the page, spinning in opposite
  directions off one shared clock, so the two stay in
  perfect sync, fronts meeting fronts. Same renderer and
  same drawing as CupCanvas, with three economy rules for
  ornament duty: smaller box, every other frame, and no
  claim on the shared spin state, which stays the hero
  cup's alone. Hidden on narrow screens by CSS, where the
  page margins do not exist.
*/
const EPOCH = performance.now();

export default function SideCup({ direction = 1, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let raf = 0;
    let visible = true;

    const draw = (phase) => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const frame = renderFrame(phase);
      const { vals, hits } = frame;
      const u = Math.max(w / (COLS * CELL_ASPECT), h / ROWS);
      const ox = (w - COLS * CELL_ASPECT * u) / 2;
      const oy = (h - ROWS * u) / 2;
      ctx.font = `${u}px "Courier New", Courier, monospace`;
      ctx.textBaseline = "top";
      let lastColor = null;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          if (hits[i] <= 0.25) continue;
          const v = Math.max(0, Math.min(1, vals[i] / Math.max(hits[i], 1e-6)));
          const ci = Math.min(
            RAMP.length - 1,
            Math.floor(v * (RAMP.length - 1)),
          );
          const ch = RAMP[ci];
          if (ch === " ") continue;
          const f = 0.25 + 0.75 * v;
          const yNorm = y / (ROWS - 1);
          const warmth = Math.min(
            0.55,
            0.12 +
              0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, v))) +
              0.2 * Math.max(0, (yNorm - 0.45) / 0.55),
          );
          const cr = IVORY[0] * (1 - warmth) + 1.0 * warmth;
          const cg = IVORY[1] * (1 - warmth) + 0.55 * warmth;
          const cb = IVORY[2] * (1 - warmth) + 0.22 * warmth;
          const color = `rgb(${Math.round(cr * f * 255)},${Math.round(
            cg * f * 255,
          )},${Math.round(cb * f * 255)})`;
          if (color !== lastColor) {
            ctx.fillStyle = color;
            lastColor = color;
          }
          ctx.fillText(ch, ox + x * CELL_ASPECT * u, oy + y * u);
        }
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "80px" },
    );
    io.observe(parent);

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      draw(0.9);
    } else {
      let tick = 0;
      const loop = (now) => {
        tick += 1;
        if (tick % 2 === 0 && visible) {
          const phase =
            direction *
            ((((now - EPOCH) / SPIN_MS) * Math.PI * 2) % (Math.PI * 2));
          draw(phase);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => draw(0.9));
    ro.observe(parent);
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [direction]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={ref} className="side-cup-fill" />
    </div>
  );
}
