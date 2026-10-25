import { useEffect, useRef } from "react";
import desktopGrid from "../assets/grass-grid-desktop.json";
import mobileGrid from "../assets/grass-grid-mobile.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  WindGrass: the About page grass field with weather (Nick's
  plan, approved Oct 25, 2026, streak count set to 3-4 by him).

  Two stacked canvases. The base is the static blades-C field
  exactly as before, drawn once per resize. The wind layer is
  transparent until weather happens:

  - Gusts are events. Every 6-10 seconds a gust crosses in
    about 3.2 seconds along a gently arced path. Inside the
    gust's neighborhood the wind layer paints out the base and
    re-stamps those blades leaned along the path's direction,
    fluttering at the peak, brightened as if the blades turned
    to catch light (the curl: lean follows the arc's tangent,
    so blades tip right, then right-and-down, then settle).
  - 3-4 faint streak trails ride each gust, dashes following
    the same arced path, the wind made visible.
  - Between gusts the field rests with a sparse brightness
    shimmer on a few hundred blades, so it is never quite dead
    at zero per-frame cost beyond those stamps.

  Perf discipline, learned the hard way on the homepage: all
  glyphs are pre-rendered sprite stamps, nothing rotates, the
  wind layer only redraws its gust neighborhood, cells hidden
  under the About panel are never stamped, and the layer idles
  at about 20fps. Reduced motion gets the static field only.
*/
const CELL_ASPECT = 0.6;
const STREAK_CHARS = ["-", "~", "·", "–"];

export default function WindGrass({ opacity = 0.6 }) {
  const baseRef = useRef(null);
  const windRef = useRef(null);

  useEffect(() => {
    const base = baseRef.current;
    const wind = windRef.current;
    if (!base || !wind) return;
    const stage = base.parentElement;
    let raf = 0;
    let cells = [];
    let panelRect = null;
    let grid = null;
    let u = 0;
    let W = 0;
    let H = 0;
    let visible = true;
    const dim = Math.min(1, opacity * 1.08);

    // --- sprite stamps, top-left anchored to match fillText ---
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
    const stamp = (ctx, sp, gx, gy, flip) => {
      if (flip) {
        ctx.drawImage(sp.c, gx - 2, gy - 2 + sp.h, sp.w, -sp.h);
      } else {
        ctx.drawImage(sp.c, gx - 2, gy - 2, sp.w, sp.h);
      }
    };

    const buildBase = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      if (!W || !H) return;
      grid = W < 720 ? mobileGrid : desktopGrid;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const cv of [base, wind]) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
      }
      const ctx = base.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0a0a09";
      ctx.fillRect(0, 0, W, H);
      u = W / (grid.cols * CELL_ASPECT);
      const tileH = grid.rows * u;
      const tile = document.createElement("canvas");
      tile.width = Math.max(1, Math.round(W * dpr));
      tile.height = Math.max(1, Math.round(tileH * dpr));
      const tg = tile.getContext("2d");
      tg.scale(dpr, dpr);
      tg.font = `${u}px "Courier New", Courier, monospace`;
      tg.textBaseline = "top";
      let lastColor = null;
      for (let y = 0; y < grid.rows; y++) {
        for (let x = 0; x < grid.cols; x++) {
          const ci = grid.cells[y][x];
          if (ci < 0) continue;
          const color = grid.palette[ci];
          if (color !== lastColor) {
            tg.fillStyle = color;
            lastColor = color;
          }
          tg.fillText(grid.lines[y][x], x * CELL_ASPECT * u, y * u);
        }
      }
      for (let ty = 0, idx = 0; ty < H; ty += tileH, idx++) {
        if (idx % 2 === 0) {
          ctx.drawImage(tile, 0, ty, W, tileH);
        } else {
          ctx.save();
          ctx.translate(0, ty + tileH);
          ctx.scale(1, -1);
          ctx.drawImage(tile, 0, 0, W, tileH);
          ctx.restore();
        }
      }
      // flat cell list in stage coordinates for the wind layer
      cells = [];
      const cellW = CELL_ASPECT * u;
      for (let ty = 0, idx = 0; ty < H; ty += tileH, idx++) {
        const flip = idx % 2 === 1;
        for (let y = 0; y < grid.rows; y++) {
          for (let x = 0; x < grid.cols; x++) {
            const ci = grid.cells[y][x];
            if (ci < 0) continue;
            const gy = flip ? ty + tileH - y * u - u : ty + y * u;
            cells.push({
              x: x * cellW,
              y: gy,
              ch: grid.lines[y][x],
              col: grid.palette[ci],
              flip,
              hash: ((x * 73856093) ^ (y * 19349663) ^ (idx * 83492791)) % 1000 / 1000,
            });
          }
        }
      }
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
      spriteCache.clear();
    };

    const inPanel = (x, y) =>
      panelRect && x > panelRect.x0 && x < panelRect.x1 && y > panelRect.y0 && y < panelRect.y1;

    // --- weather state ---
    let gust = null;
    let nextGustAt = performance.now() / 1000 + 1.4;
    const spawnGust = (now) => {
      const dirDown = Math.random() < 0.5 ? 1 : -1;
      gust = {
        t0: now,
        dur: 3.2,
        yBase: H * (0.25 + Math.random() * 0.5),
        arc: dirDown * H * (0.08 + Math.random() * 0.1),
        sigmaX: W * 0.16,
        sigmaY: H * 0.16,
        streaks: Array.from({ length: 4 }, () => ({
          lag: 40 + Math.random() * 120,
          yOff: (Math.random() - 0.5) * H * 0.14,
          segs: 6 + ((Math.random() * 4) | 0),
          phase: Math.random() * 6.28,
        })),
      };
    };

    const drawWind = (now) => {
      const ctx = wind.getContext("2d");
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!gust && now >= nextGustAt) spawnGust(now);

      // ambient shimmer: a few hundred blades breathing light
      const shimCount = 240;
      for (let i = 0; i < shimCount; i++) {
        const cell = cells[(Math.random() * cells.length) | 0];
        if (!cell || inPanel(cell.x, cell.y)) continue;
        const b = 1 + 0.14 * Math.sin(now * 0.9 + cell.hash * 6.28);
        if (b <= 1.03) continue;
        stamp(ctx, sprite(cell.ch, shade(cell.col, bucket(b * dim, 0.06))), cell.x, cell.y, cell.flip);
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
      const box = {
        x0: gx - 2.3 * gust.sigmaX,
        x1: gx + 2.3 * gust.sigmaX,
        y0: gy - 2.3 * gust.sigmaY,
        y1: gy + 2.3 * gust.sigmaY,
      };
      ctx.fillStyle = "#0a0a09";
      ctx.fillRect(
        Math.max(0, box.x0),
        Math.max(0, box.y0),
        Math.min(W, box.x1) - Math.max(0, box.x0),
        Math.min(H, box.y1) - Math.max(0, box.y0),
      );
      for (const cell of cells) {
        const cx = cell.x + CELL_ASPECT * u * 0.5;
        const cy = cell.y + u * 0.5;
        if (cx < box.x0 || cx > box.x1 || cy < box.y0 || cy > box.y1) continue;
        if (inPanel(cx, cy)) continue;
        const dxn = (cx - gx) / gust.sigmaX;
        const dyn = (cy - gy) / gust.sigmaY;
        const g = Math.exp(-(dxn * dxn + dyn * dyn));
        const flutter = Math.sin(now * 11 + cell.hash * 6.28) * 1.6 * g * g;
        const lean = 8 * g + flutter;
        const b = bucket((1 + 0.4 * g) * dim, 0.06);
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
          const sx = hx - j * CELL_ASPECT * u * 2.2;
          const sy = hy + Math.sin(j * 0.7 - now * 3 + s.phase) * 2 + j * 1.1;
          if (sx < -10 || sx > W + 10 || inPanel(sx, sy)) continue;
          const ch = STREAK_CHARS[(j + ((s.phase * 10) | 0)) % STREAK_CHARS.length];
          stamp(ctx, sprite(ch, shade("#f2ede1", bucket(0.55 * fade + 0.05, 0.06))), sx, sy, false);
        }
      }
    };

    buildBase();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastDraw = 0;
    if (!reduced) {
      const loop = () => {
        const now = performance.now() / 1000;
        if (visible && now - lastDraw >= 0.05) {
          drawWind(now);
          lastDraw = now;
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
    <>
      <canvas
        ref={baseRef}
        className="ascii-field"
        style={{ opacity }}
        aria-hidden="true"
      />
      <canvas
        ref={windRef}
        className="ascii-field"
        style={{ opacity: 1, zIndex: 1 }}
        aria-hidden="true"
      />
    </>
  );
}
