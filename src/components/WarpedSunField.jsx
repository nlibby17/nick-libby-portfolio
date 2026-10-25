import { useEffect, useRef } from "react";
import sunGrid from "../assets/sun-grid.json";
import { COLS, ROWS, renderFrame } from "../lib/cupGeometry.js";
import { spinState } from "../lib/spinState.js";

/*
  WarpedSunField: the homepage sun backdrop, deforming around
  the hero cup. Design settled with Nick, Oct 25, 2026:
  - Flow-around plus a touch of lens dimple: samples are pushed
    away from the cup's silhouette, with a slight inward pinch
    very close in. No swirl (killed; it read as noise).
  - Pose-coupled: the silhouette comes from the cup renderer's
    own hit mask at the live spin phase, so the bend reshapes
    as the cup turns.
  - Tight reach: influence ends 25 percent of the cup's width
    beyond the silhouette.
  - Strength gradient: full at the silhouette's edge, fading
    smoothly to zero at the reach boundary.
  - Order preserved: the pattern is only ever resampled from
    smoothly displaced positions, never scrambled.
  Implementation: the pristine field is rendered once to an
  offscreen canvas and blitted each tick; only cells inside
  the cup's neighborhood are redrawn, warped, over it.
*/
const CELL_ASPECT = 0.6;
const PUSH = 13; // px of outward deflection at the edge
const PINCH = 5; // px of inward lens pinch, closest range only
const SDF_RES = 6; // px per distance-field cell

export default function WarpedSunField({ opacity = 0.5 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const grid = sunGrid;
    let raf = 0;
    let pristine = null;
    let pw = 0;
    let ph = 0;
    let tick = 0;

    const cover = (w, h) => {
      const u = Math.max(w / (grid.cols * CELL_ASPECT), h / grid.rows);
      return { u, ox: (w - grid.cols * CELL_ASPECT * u) / 2, oy: 0 };
    };

    const drawPristine = (ctx, w, h) => {
      const { u, ox, oy } = cover(w, h);
      ctx.fillStyle = "#0a0a09";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${u}px "Courier New", Courier, monospace`;
      ctx.textBaseline = "top";
      let last = null;
      for (let y = 0; y < grid.rows; y++) {
        const line = grid.lines[y];
        const rowCells = grid.cells[y];
        const py = oy + y * u;
        if (py < -u || py > h) continue;
        for (let x = 0; x < grid.cols; x++) {
          const ci = rowCells[x];
          if (ci < 0) continue;
          const px = ox + x * CELL_ASPECT * u;
          if (px < -CELL_ASPECT * u || px > w) continue;
          const color = grid.palette[ci];
          if (color !== last) {
            ctx.fillStyle = color;
            last = color;
          }
          ctx.fillText(line[x], px, py);
        }
      }
    };

    const buildPristine = () => {
      pw = parent.clientWidth;
      ph = parent.clientHeight;
      if (!pw || !ph) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(pw * dpr);
      canvas.height = Math.round(ph * dpr);
      canvas.style.width = `${pw}px`;
      canvas.style.height = `${ph}px`;
      pristine = document.createElement("canvas");
      pristine.width = canvas.width;
      pristine.height = canvas.height;
      const pctx = pristine.getContext("2d");
      pctx.scale(dpr, dpr);
      drawPristine(pctx, pw, ph);
    };

    const drawWarp = () => {
      if (!pristine || !pw) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(pristine, 0, 0, pw, ph);

      const stage = document.querySelector(".cup-stage");
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      if (rect.bottom < -140 || rect.top > ph + 140 || rect.width < 10) return;

      const phase = spinState.phase;
      const frame =
        spinState.frame && Math.abs(spinState.frame.phase - phase) < 0.06
          ? spinState.frame
          : { phase, ...renderFrame(phase) };
      const hits = frame.hits;

      const reach = rect.width * 0.25;
      const x0 = Math.max(0, rect.left - reach - 12);
      const y0 = Math.max(0, rect.top - reach - 12);
      const x1 = Math.min(pw, rect.right + reach + 12);
      const y1 = Math.min(ph, rect.bottom + reach + 12);
      const gw = Math.max(2, Math.ceil((x1 - x0) / SDF_RES));
      const gh = Math.max(2, Math.ceil((y1 - y0) / SDF_RES));
      const INF = 1e6;
      const dist = new Float32Array(gw * gh).fill(INF);
      for (let j = 0; j < gh; j++) {
        const py = y0 + (j + 0.5) * SDF_RES;
        const ly = Math.floor(((py - rect.top) / rect.height) * ROWS);
        for (let i = 0; i < gw; i++) {
          const px = x0 + (i + 0.5) * SDF_RES;
          const lx = Math.floor(((px - rect.left) / rect.width) * COLS);
          if (lx >= 0 && lx < COLS && ly >= 0 && ly < ROWS) {
            if (hits[ly * COLS + lx] > 0.25) dist[j * gw + i] = 0;
          }
        }
      }
      const D = SDF_RES;
      const DD = SDF_RES * Math.SQRT2;
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const k = j * gw + i;
          let d = dist[k];
          if (i > 0) d = Math.min(d, dist[k - 1] + D);
          if (j > 0) d = Math.min(d, dist[k - gw] + D);
          if (i > 0 && j > 0) d = Math.min(d, dist[k - gw - 1] + DD);
          if (i < gw - 1 && j > 0) d = Math.min(d, dist[k - gw + 1] + DD);
          dist[k] = d;
        }
      }
      for (let j = gh - 1; j >= 0; j--) {
        for (let i = gw - 1; i >= 0; i--) {
          const k = j * gw + i;
          let d = dist[k];
          if (i < gw - 1) d = Math.min(d, dist[k + 1] + D);
          if (j < gh - 1) d = Math.min(d, dist[k + gw] + D);
          if (i < gw - 1 && j < gh - 1) d = Math.min(d, dist[k + gw + 1] + DD);
          if (i > 0 && j < gh - 1) d = Math.min(d, dist[k + gw - 1] + DD);
          dist[k] = d;
        }
      }

      const { u, ox, oy } = cover(pw, ph);
      const cellW = CELL_ASPECT * u;
      ctx.font = `${u}px "Courier New", Courier, monospace`;
      ctx.textBaseline = "top";
      const gx0 = Math.max(0, Math.floor((x0 - ox) / cellW));
      const gx1 = Math.min(grid.cols - 1, Math.ceil((x1 - ox) / cellW));
      const gy0 = Math.max(0, Math.floor((y0 - oy) / u));
      const gy1 = Math.min(grid.rows - 1, Math.ceil((y1 - oy) / u));
      let last = null;
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const px = ox + gx * cellW;
          const py = oy + gy * u;
          const cx = px + cellW / 2;
          const cy = py + u / 2;
          const si = Math.min(gw - 1, Math.max(0, Math.floor((cx - x0) / SDF_RES)));
          const sj = Math.min(gh - 1, Math.max(0, Math.floor((cy - y0) / SDF_RES)));
          const k = sj * gw + si;
          const d = dist[k];
          if (d >= reach || d < 0.5) continue;
          const gxGrad =
            dist[sj * gw + Math.min(gw - 1, si + 1)] -
            dist[sj * gw + Math.max(0, si - 1)];
          const gyGrad =
            dist[Math.min(gh - 1, sj + 1) * gw + si] -
            dist[Math.max(0, sj - 1) * gw + si];
          const gl = Math.hypot(gxGrad, gyGrad);
          if (gl < 1e-6) continue;
          const nx = gxGrad / gl;
          const ny = gyGrad / gl;
          const g = (1 - d / reach) ** 2;
          const off = PUSH * g - PINCH * g * g;
          const sx = cx + nx * off;
          const sy = cy + ny * off;
          const sgx = Math.round((sx - ox) / cellW);
          const sgy = Math.round((sy - oy) / u);
          ctx.fillStyle = "#0a0a09";
          ctx.fillRect(px, py, cellW + 0.75, u + 0.75);
          if (sgx < 0 || sgx >= grid.cols || sgy < 0 || sgy >= grid.rows) continue;
          const ci = grid.cells[sgy][sgx];
          if (ci < 0) continue;
          const color = grid.palette[ci];
          if (color !== last) {
            ctx.fillStyle = color;
            last = color;
          }
          ctx.fillText(grid.lines[sgy][sgx], px, py);
        }
      }
    };

    buildPristine();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      drawWarp();
    } else {
      const loop = () => {
        tick += 1;
        if (tick % 2 === 0) drawWarp();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => {
      buildPristine();
      drawWarp();
    });
    ro.observe(parent);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="ascii-field"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
