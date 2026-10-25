import { useEffect, useRef } from "react";
import sunGrid from "../assets/sun-grid.json";
import { COLS, ROWS, renderFrame } from "../lib/cupGeometry.js";
import { spinState } from "../lib/spinState.js";

/*
  WarpedSunField: the homepage sun backdrop, gravitationally
  lensed by the hero cup. Design settled with Nick, Oct 25, 2026:
  - The lens is radial around the cup's center of mass, not a
    push along the silhouette. Screen points sample the field
    from closer to the center, so the pattern compresses into
    arcs near the cup: the black-hole signature.
  - The strength curve is steep near the edge (cubic in the
    normalized distance), polite farther out, plus a faint long
    tail so distant rays still acknowledge the mass.
  - Where the lensed source would fall inside the cup, the cell
    is left dark: a moat. Where it lands just outside the cup,
    the character is brightened: a photon ring.
  - The silhouette (edge, moat, ring) comes from the cup
    renderer's own hit mask at the live spin phase, so the lens
    furniture follows the pose while the lens itself stays
    anchored to the center of mass.
  - No swirl, no accretion flow: the field is a fixed texture
    under a lens, so nothing is eaten and nothing needs
    respawning. Nick's call, Oct 25, 2026.
  Implementation: the pristine field is rendered once to an
  offscreen canvas and blitted each tick; only cells inside
  the cup's neighborhood are redrawn, lensed, over it.
*/
const CELL_ASPECT = 0.6;
const CORE_DEFLECT = 90; // px of inward lens pull at the edge
const TAIL_DEFLECT = 6; // px of pull at the core/tail boundary
const RING_WIDTH = 10; // px of source distance that reads as the ring
const SDF_RES = 6; // px per distance-field cell

function brighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c, t) => Math.round(c + (t - c) * 0.55);
  return `rgb(${mix(r, 255)},${mix(g, 237)},${mix(b, 176)})`;
}

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
      if (rect.bottom < -340 || rect.top > ph + 340 || rect.width < 10) return;

      const phase = spinState.phase;
      const frame =
        spinState.frame && Math.abs(spinState.frame.phase - phase) < 0.06
          ? spinState.frame
          : { phase, ...renderFrame(phase) };
      const hits = frame.hits;

      const coreReach = rect.width * 0.25;
      const tailReach = rect.width * 0.7;
      const comX = rect.left + rect.width / 2;
      const comY = rect.top + rect.height / 2;
      const x0 = Math.max(0, rect.left - tailReach - 12);
      const y0 = Math.max(0, rect.top - tailReach - 12);
      const x1 = Math.min(pw, rect.right + tailReach + 12);
      const y1 = Math.min(ph, rect.bottom + tailReach + 12);
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
          if (d >= tailReach || d < 0.5) continue;
          // Radial lens around the center of mass: sample the
          // field from closer to the center than the screen
          // point, steeply near the edge, faintly in the tail.
          const vx = cx - comX;
          const vy = cy - comY;
          const r = Math.hypot(vx, vy);
          if (r < 1) continue;
          let defl;
          if (d <= coreReach) {
            const t = 1 - d / coreReach;
            defl = CORE_DEFLECT * t ** 3;
          } else {
            const t = 1 - (d - coreReach) / (tailReach - coreReach);
            defl = TAIL_DEFLECT * t * t;
          }
          const sx = cx - (vx / r) * defl;
          const sy = cy - (vy / r) * defl;
          const ssi = Math.min(gw - 1, Math.max(0, Math.floor((sx - x0) / SDF_RES)));
          const ssj = Math.min(gh - 1, Math.max(0, Math.floor((sy - y0) / SDF_RES)));
          const ds = dist[ssj * gw + ssi];
          ctx.fillStyle = "#0a0a09";
          ctx.fillRect(px, py, cellW + 0.75, u + 0.75);
          last = null;
          if (ds <= 0.5) continue; // moat: the lens ate this light
          const sgx = Math.round((sx - ox) / cellW);
          const sgy = Math.round((sy - oy) / u);
          if (sgx < 0 || sgx >= grid.cols || sgy < 0 || sgy >= grid.rows) continue;
          const ci = grid.cells[sgy][sgx];
          if (ci < 0) continue;
          let color = grid.palette[ci];
          if (ds <= RING_WIDTH) color = brighten(color);
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
