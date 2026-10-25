import { useEffect, useRef } from "react";
import desktopGrid from "../assets/grass-grid-desktop.json";
import mobileGrid from "../assets/grass-grid-mobile.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  WindGrass: the About page grass field with weather (Nick's
  plan, approved Oct 25, 2026, streak count set to 3-4 by him).

  ONE canvas, one offscreen base rendered with the same sprite
  stamps the wind uses; each wind frame blits the base back
  before painting weather, so a gust repaints inside the same
  material as the field around it (the stacked-canvas version
  showed its erase rectangle as a tinted pane; Nick caught it).

  Weather: gusts are events, every 6-10 seconds, crossing in
  about 3.2 seconds along an arced path. Blades in the gust
  lean along the path's direction, flutter at the peak, and
  brighten. 3-4 faint streak trails ride each gust. Between
  gusts, a sparse shimmer keeps the field from looking dead.

  Perf discipline (the first wind build saturated the main
  thread on weaker hardware and the page never painted):
  - At spawn, a gust precomputes its swept band of cells,
    sorted by x; frames iterate only a sliding window of it.
  - Only cells the gust actually moves get re-stamped, each
    wiped with a per-cell background fill first. No big erase
    rectangle, no stamps for blades that would not change.
  - Gust frames run at about 12fps, and after an expensive
    frame the next one waits, so the thread always gets
    breathing room. Three very slow frames disable the wind
    for the session (shimmer remains) rather than fight the
    machine. Cells under the About panel are never stamped.
  Reduced motion: static field only.
*/
const CELL_ASPECT = 0.6;
const STREAK_CHARS = ["-", "~", "·", "–"];

export default function WindGrass({ opacity = 0.6 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let cells = [];
    let panelRect = null;
    let grid = null;
    let u = 0;
    let W = 0;
    let H = 0;
    let visible = true;
    let baseImg = null;
    let windDisabled = false;
    let slowFrames = 0;

    // --- sprite stamps, top-left anchored to match cell origins ---
    const spriteCache = new Map();
    const sprite = (ch, colorCss) => {
      const key = `${ch}|${colorCss}`;
      let sp = spriteCache.get(key);
      if (sp) return sp;
      if (spriteCache.size > 9000) spriteCache.clear();
      const ss = 2;
      const wCss = CELL_ASPECT * u + 4;
      const hCss = u + 4;
      const c = document.createElement("canvas");
      c.width = Math.ceil(wCss * ss);
      c.height = Math.ceil(hCss * ss);
      const g = c.getContext("2d");
      g.scale(ss, ss);
      g.font = `${u}px "Courier New", Courier, monospace`;
      g.textBaseline = "top";
      g.fillStyle = colorCss;
      g.fillText(ch, 2, 2);
      sp = { c, w: wCss, h: hCss };
      spriteCache.set(key, sp);
      return sp;
    };
    const stamp = (c2d, sp, gx, gy, flip) => {
      if (flip) {
        c2d.drawImage(sp.c, gx - 2, gy - 2 + sp.h, sp.w, -sp.h);
      } else {
        c2d.drawImage(sp.c, gx - 2, gy - 2, sp.w, sp.h);
      }
    };

    const buildBase = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      if (!W || !H) return;
      grid = W < 720 ? mobileGrid : desktopGrid;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      u = W / (grid.cols * CELL_ASPECT);
      spriteCache.clear();

      cells = [];
      const tileH = grid.rows * u;
      const cellW = CELL_ASPECT * u;
      for (let ty = 0, idx = 0; ty < H; ty += tileH, idx++) {
        const flip = idx % 2 === 1;
        for (let y = 0; y < grid.rows; y++) {
          for (let x = 0; x < grid.cols; x++) {
            const ci = grid.cells[y][x];
            if (ci < 0) continue;
            cells.push({
              x: x * cellW,
              y: flip ? ty + tileH - y * u - u : ty + y * u,
              ch: grid.lines[y][x],
              col: grid.palette[ci],
              flip,
              hash: (((x * 73856093) ^ (y * 19349663) ^ (idx * 83492791)) >>> 0) % 1000 / 1000,
            });
          }
        }
      }
      cells.sort((a, b) => a.x - b.x);

      baseImg = document.createElement("canvas");
      baseImg.width = canvas.width;
      baseImg.height = canvas.height;
      const bg = baseImg.getContext("2d");
      bg.scale(dpr, dpr);
      bg.fillStyle = "#0a0a09";
      bg.fillRect(0, 0, W, H);
      for (const cell of cells) {
        stamp(bg, sprite(cell.ch, cell.col), cell.x, cell.y, cell.flip);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);

      const panel = stage.querySelector(".about-panel");
      if (panel) {
        const sr = stage.getBoundingClientRect();
        const pr = panel.getBoundingClientRect();
        panelRect = {
          x0: pr.left - sr.left - 12,
          y0: pr.top - sr.top - 12,
          x1: pr.right - sr.left + 12,
          y1: pr.bottom - sr.top + 12,
        };
      } else {
        panelRect = null;
      }
    };

    const inPanel = (x, y) =>
      panelRect && x > panelRect.x0 && x < panelRect.x1 && y > panelRect.y0 && y < panelRect.y1;

    // --- weather state ---
    let gust = null;
    let nextGustAt = performance.now() / 1000 + 1.4;
    const pathY = (g, x) => {
      const p = (x + 0.25 * W) / (1.5 * W);
      return g.yBase + g.arc * Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
    };
    const spawnGust = (now) => {
      const dirDown = Math.random() < 0.5 ? 1 : -1;
      const g = {
        t0: now,
        dur: 3.2,
        yBase: H * (0.25 + Math.random() * 0.5),
        arc: dirDown * H * (0.08 + Math.random() * 0.1),
        sigmaX: W * 0.16,
        sigmaY: H * 0.12,
        streaks: Array.from({ length: 4 }, () => ({
          lag: 40 + Math.random() * 120,
          yOff: (Math.random() - 0.5) * H * 0.14,
          segs: 6 + ((Math.random() * 4) | 0),
          phase: Math.random() * 6.28,
        })),
        band: null,
      };
      // the swept band: cells near the arc, already x-sorted
      g.band = cells.filter((cell) => {
        const cy = cell.y + u * 0.5;
        return Math.abs(cy - pathY(g, cell.x)) < 2.4 * g.sigmaY;
      });
      gust = g;
    };

    const drawWind = (now) => {
      if (!baseImg) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!windDisabled && !gust && now >= nextGustAt) spawnGust(now);

      // ambient shimmer: a few hundred blades breathing light
      for (let i = 0; i < 240; i++) {
        const cell = cells[(Math.random() * cells.length) | 0];
        if (!cell || inPanel(cell.x, cell.y)) continue;
        const b = 1 + 0.14 * Math.sin(now * 0.9 + cell.hash * 6.28);
        if (b <= 1.03) continue;
        stamp(ctx, sprite(cell.ch, shade(cell.col, bucket(b, 0.06))), cell.x, cell.y, cell.flip);
      }

      if (!gust) return;
      const t = (now - gust.t0) / gust.dur;
      if (t >= 1) {
        gust = null;
        nextGustAt = now + 6 + Math.random() * 4;
        return;
      }
      const gx = -0.25 * W + 1.5 * W * t;
      const gy = gust.yBase + gust.arc * Math.sin(Math.PI * t);
      const vx = (1.5 * W) / gust.dur;
      const vy = (gust.arc * Math.PI * Math.cos(Math.PI * t)) / gust.dur;
      const theta = Math.atan2(vy, vx);
      const dirX = Math.cos(theta);
      const dirY = Math.sin(theta);
      const cellW = CELL_ASPECT * u;
      const xLo = gx - 2.2 * gust.sigmaX;
      const xHi = gx + 2.2 * gust.sigmaX;
      const band = gust.band;
      // sliding window over the x-sorted band
      let lo = 0;
      let hi = band.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (band[mid].x < xLo) lo = mid + 1;
        else hi = mid;
      }
      const start = lo;
      hi = band.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (band[mid].x <= xHi) lo = mid + 1;
        else hi = mid;
      }
      const end = lo;
      // pass 1: wipe only the cells the gust truly moves
      const moved = [];
      for (let i = start; i < end; i++) {
        const cell = band[i];
        const cx = cell.x + cellW * 0.5;
        const cy = cell.y + u * 0.5;
        if (inPanel(cx, cy)) continue;
        const dxn = (cx - gx) / gust.sigmaX;
        const dyn = (cy - gy) / gust.sigmaY;
        const g = Math.exp(-(dxn * dxn + dyn * dyn));
        if (g <= 0.05) continue;
        moved.push([cell, g]);
      }
      ctx.fillStyle = "#0a0a09";
      for (const [cell] of moved) {
        ctx.fillRect(cell.x - 0.5, cell.y - 0.5, cellW + 1, u + 1);
      }
      // pass 2: stamp them leaned, fluttered, brightened
      for (const [cell, g] of moved) {
        const flutter = Math.sin(now * 11 + cell.hash * 6.28) * 1.6 * g * g;
        const lean = 8 * g + flutter;
        const b = bucket(1 + 0.4 * g, 0.06);
        stamp(
          ctx,
          sprite(cell.ch, shade(cell.col, b)),
          cell.x + dirX * lean,
          cell.y + dirY * lean,
          cell.flip,
        );
      }
      // streaks ride the gust, 3-4 visible trails
      const life = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      for (const s of gust.streaks) {
        const hx = gx - s.lag;
        const hy = gy + s.yOff + Math.sin(now * 2 + s.phase) * 4;
        for (let j = 0; j < s.segs; j++) {
          const fade = (1 - j / s.segs) * life;
          if (fade < 0.08) continue;
          const sx = hx - j * cellW * 2.2;
          const sy = hy + Math.sin(j * 0.7 - now * 3 + s.phase) * 2 + j * 1.1;
          if (sx < -10 || sx > W + 10 || inPanel(sx, sy)) continue;
          const ch = STREAK_CHARS[(j + ((s.phase * 10) | 0)) % STREAK_CHARS.length];
          stamp(ctx, sprite(ch, shade("#f2ede1", bucket(0.55 * fade + 0.05, 0.06))), sx, sy, false);
        }
      }
    };

    buildBase();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastStart = 0;
    let lastCost = 0;
    if (!reduced) {
      const loop = () => {
        const now = performance.now() / 1000;
        // Gust frames: about 12fps, and always leave the thread
        // a gap after an expensive frame. Ambient frames: 20fps.
        const interval = gust ? Math.max(0.083, lastCost + 0.03) : 0.05;
        if (visible && now - lastStart >= interval) {
          lastStart = now;
          const t0 = performance.now();
          drawWind(now);
          lastCost = (performance.now() - t0) / 1000;
          if (lastCost > 0.12) {
            slowFrames += 1;
            if (slowFrames >= 3) {
              windDisabled = true;
              gust = null;
            }
          } else if (slowFrames > 0) {
            slowFrames -= 1;
          }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "80px" },
    );
    io.observe(stage);
    const ro = new ResizeObserver(() => buildBase());
    ro.observe(stage);
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [opacity]);

  return (
    <canvas
      ref={ref}
      className="ascii-field"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
