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
import { spinState } from "../lib/spinState.js";

/*
  CupCanvas: draws the hero cup from the shared geometry
  renderer (see lib/cupGeometry.js for the model and the
  rotation spec) and publishes the spin phase so the sun
  backdrop can deform around the cup's live pose.
*/
export default function CupCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let raf = 0;
    let phase = 0;

    const draw = () => {
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
      spinState.phase = phase;
      spinState.frame = { phase, ...frame };
      const { vals, hits } = frame;
      const u = Math.max(w / (COLS * CELL_ASPECT), h / ROWS);
      const ox = (w - COLS * CELL_ASPECT * u) / 2;
      const oy = (h - ROWS * u) / 2;
      ctx.font = `${u}px "Courier New", Courier, monospace`;
      ctx.textBaseline = "top";
      let last = null;
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
          const color = `rgb(${Math.round(IVORY[0] * f * 255)},${Math.round(
            IVORY[1] * f * 255,
          )},${Math.round(IVORY[2] * f * 255)})`;
          if (color !== last) {
            ctx.fillStyle = color;
            last = color;
          }
          ctx.fillText(ch, ox + x * CELL_ASPECT * u, oy + y * u);
        }
      }
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      draw();
    } else {
      const t0 = performance.now();
      const loop = (now) => {
        phase = (((now - t0) / SPIN_MS) * Math.PI * 2) % (Math.PI * 2);
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => draw());
    ro.observe(parent);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="ascii-field" aria-hidden="true" />;
}
