import { useEffect, useRef } from "react";
import sunGrid from "../assets/sun-grid.json";
import { COLS, ROWS, renderFrame } from "../lib/cupGeometry.js";
import { spinState } from "../lib/spinState.js";
import { shade } from "../lib/discParticles.js";

/*
  WarpedSunField: the homepage sun backdrop, warped by the
  hero cup acting as a spherical mass. Built from the offline
  prototypes Nick approved (Oct 25, 2026) and the published
  techniques the research surfaced:
  - The mass is a SPHERE approximating the cup's overall shape,
    centered on its center of mass. The visible occlusion is
    the cup's own silhouette (from the cup renderer's hit
    mask, padded slightly), so the void is cup-shaped.
  - Letters MOVE (forward mapping): each glyph in the zone is
    displaced inward with a steep fade, dragged tangentially,
    rotated to the local flow, stretched along it, and
    brightened or bolded as the local squeeze demands. That is
    what makes the bending curves legible; the earlier
    grid-resampling versions could not curve a row.
  - The displacement is windowed to zero at the zone edge, so
    the warped neighborhood joins the pristine field with no
    seam. The warp geometry is cached as per-glyph deltas
    (translation-invariant under scrolling); only the
    occlusion mask is rebuilt per tick.
  - Beyond the disc's bright work the field is a pristine
    offscreen render, blitted each tick.
*/
const CELL_ASPECT = 0.6;
const PULL0 = 0.17; // inward pull at the surface, x stage width
const TWIST0 = 0.55; // tangential drag at the surface, radians
const FULL_R = 1.9; // rotated treatment inside this x sphere radius
const ZONE_R = 3.4; // warp zone edge, x sphere radius
const SDF_RES = 6;

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
    let cache = null;

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
      cache = null;
    };

    const warpRaw = (x, y, comX, comY, sphereR, stageW) => {
      const vx = x - comX;
      const vy = y - comY;
      const r = Math.hypot(vx, vy);
      if (r < 1e-6) return [x, y, r];
      const ratio = sphereR / r;
      const pull = PULL0 * stageW * Math.pow(ratio, 2.2);
      const twist = TWIST0 * ratio * ratio;
      const th = Math.atan2(vy, vx) + twist;
      const r2 = Math.max(r - pull, 1);
      // window: full strength inside 2.6 radii, smooth to 0 at edge
      let w = 1;
      const e0 = sphereR * 2.6;
      const e1 = sphereR * ZONE_R;
      if (r > e0) {
        const t = Math.min(1, (r - e0) / (e1 - e0));
        w = 1 - t * t * (3 - 2 * t);
      }
      const mx = comX + r2 * Math.cos(th);
      const my = comY + r2 * Math.sin(th);
      return [x + (mx - x) * w, y + (my - y) * w, r];
    };

    const buildCache = (comX, comY, sphereR, stageW) => {
      const { u, ox, oy } = cover(pw, ph);
      const cellW = CELL_ASPECT * u;
      const zoneR = sphereR * ZONE_R;
      const gx0 = Math.max(0, Math.floor((comX - zoneR - ox) / cellW));
      const gx1 = Math.min(grid.cols - 1, Math.ceil((comX + zoneR - ox) / cellW));
      const gy0 = Math.max(0, Math.floor((comY - zoneR - oy) / u));
      const gy1 = Math.min(grid.rows - 1, Math.ceil((comY + zoneR - oy) / u));
      const list = [];
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const ci = grid.cells[gy][gx];
          if (ci < 0) continue;
          const cx = ox + gx * cellW + cellW / 2;
          const cy = oy + gy * u + u / 2;
          const [mx, my, r] = warpRaw(cx, cy, comX, comY, sphereR, stageW);
          const [mx2, my2] = warpRaw(cx + cellW, cy, comX, comY, sphereR, stageW);
          const tvecX = mx2 - mx;
          const tvecY = my2 - my;
          const stretch = Math.hypot(tvecX, tvecY) / cellW;
          const det = Math.max(0.35, Math.min(2.6, stretch));
          const bright = Math.max(0.72, Math.min(1.9, 0.72 + 0.5 / det));
          list.push({
            gx,
            gy,
            relX: cx - comX,
            relY: cy - comY,
            dx: mx - cx,
            dy: my - cy,
            ang: Math.atan2(tvecY, tvecX),
            stretch: Math.max(0.7, Math.min(1.9, stretch)),
            bright,
            bold: r < sphereR * 1.45,
            full: r < sphereR * FULL_R,
          });
        }
      }
      cache = {
        key: `${stageW.toFixed(1)}|${pw}|${ph}`,
        list,
      };
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
      if (rect.bottom < -360 || rect.top > ph + 360 || rect.width < 10) return;
      const comX = rect.left + rect.width / 2;
      const comY = rect.top + rect.height / 2;
      const sphereR = rect.width * 0.58;
      const zoneR = sphereR * ZONE_R;

      const phase = spinState.phase;
      const frame =
        spinState.frame && Math.abs(spinState.frame.phase - phase) < 0.06
          ? spinState.frame
          : { phase, ...renderFrame(phase) };
      const hits = frame.hits;

      // occlusion distance field from the live silhouette
      const x0 = Math.max(0, comX - zoneR - 24);
      const y0 = Math.max(0, comY - zoneR - 24);
      const x1 = Math.min(pw, comX + zoneR + 24);
      const y1 = Math.min(ph, comY + zoneR + 24);
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
      const distAt = (x, y) => {
        const i = Math.floor((x - x0) / SDF_RES);
        const j = Math.floor((y - y0) / SDF_RES);
        if (i < 0 || j < 0 || i >= gw || j >= gh) return INF;
        return dist[j * gw + i];
      };

      const key = `${rect.width.toFixed(1)}|${pw}|${ph}`;
      if (!cache || cache.key !== key) buildCache(comX, comY, sphereR, rect.width);

      // clear the zone, then redraw its glyphs warped
      ctx.fillStyle = "#0a0a09";
      ctx.beginPath();
      ctx.arc(comX, comY, zoneR, 0, Math.PI * 2);
      ctx.fill();

      const { u } = cover(pw, ph);
      const font = `${u}px "Courier New", Courier, monospace`;
      const fontB = `bold ${u}px "Courier New", Courier, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let lastBold = null;
      let lastColor = null;
      for (const e of cache.list) {
        const cx = comX + e.relX;
        const cy = comY + e.relY;
        if (distAt(cx, cy) < 5) continue;
        const mx = cx + e.dx;
        const my = cy + e.dy;
        if (distAt(mx, my) < 5) continue;
        if (e.bold !== lastBold) {
          ctx.font = e.bold ? fontB : font;
          lastBold = e.bold;
        }
        const color = shade(grid.palette[grid.cells[e.gy][e.gx]], e.bright);
        if (color !== lastColor) {
          ctx.fillStyle = color;
          lastColor = color;
        }
        if (e.full) {
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(e.ang);
          ctx.scale(e.stretch, 1);
          ctx.fillText(grid.lines[e.gy][e.gx], 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(grid.lines[e.gy][e.gx], mx, my);
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
        if (tick % 4 === 0) drawWarp();
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
