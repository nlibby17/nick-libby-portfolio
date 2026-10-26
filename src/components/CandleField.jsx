import { useEffect, useRef } from "react";
import grid from "../assets/candle-sky-grid.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  CandleField, final form (v3.46, Nick's call after the
  parallax wall: bail on parallax entirely, keep the art
  still, tried and true).

  The sky is one static stamped canvas. Nothing in the art
  moves: no drift, no sway, no twinkle, no breathing. Two
  effects live on a transparent FX canvas above it, and
  both only ever draw glyph-shaped marks:

  - A diagonal light swipe on a timed cycle, the same
    mechanism as the pipe shine on the Dunkin page: every
    six and a half seconds a soft band of light crosses the
    whole field diagonally over about two seconds, cells
    brightening as the front passes over them, then still
    again. Brightening is a brighter glyph stamped over the
    base copy; nothing is erased, so nothing can artifact.
  - The mouse deformation Nick kept: a seeded tenth of the
    cells ride springs around the pointer, pushed out and
    lit, overshooting home when it leaves. A displaced cell
    is hidden at its post by its own glyph drawn in black
    at partial alpha, never by a rectangle.

  Reduced motion: the still sky only.
*/
const CELL_ASPECT = 0.6;
const SEED = 133233;
const POINTER_RADIUS = 230;
const SPRING_K = 110;
const SPRING_C = 8.5;
const SWIPE_PERIOD = 6.5;
const SWIPE_DUR = 1.9;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function CandleField({ opacity = 0.6 }) {
  const baseRef = useRef(null);
  const fxRef = useRef(null);

  useEffect(() => {
    const baseCanvas = baseRef.current;
    const fxCanvas = fxRef.current;
    if (!baseCanvas || !fxCanvas) return;
    const stage = baseCanvas.parentElement.parentElement;
    const bctx = baseCanvas.getContext("2d");
    const ctx = fxCanvas.getContext("2d");
    let raf = 0;
    let W = 0;
    let H = 0;
    let u = 0;
    let visible = true;
    let cells = [];
    const pointer = { x: -9999, y: -9999, active: false, strength: 0 };

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
    const stamp = (c2d, sp, gx, gy) => {
      c2d.drawImage(sp.c, gx - 2, gy - 2, sp.w, sp.h);
    };
    const stampAlpha = (sp, gx, gy, alpha) => {
      ctx.globalAlpha = alpha;
      stamp(ctx, sp, gx, gy);
      ctx.globalAlpha = 1;
    };

    const buildBase = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const cv of [baseCanvas, fxCanvas]) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
      }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      u = Math.max(W / (grid.cols * CELL_ASPECT), H / grid.rows);
      const cellW = CELL_ASPECT * u;
      const ox = (W - grid.cols * cellW) / 2;
      const oy = (H - grid.rows * u) / 2;
      spriteCache.clear();

      const diag = Math.hypot(W, H) || 1;
      const rand = mulberry32(SEED);
      cells = [];
      for (let gy = 0; gy < grid.rows; gy++) {
        for (let gx = 0; gx < grid.cols; gx++) {
          const ci = grid.cells[gy][gx];
          if (ci < 0) continue;
          const px = ox + gx * cellW;
          const py = oy + gy * u;
          if (px < -cellW || px > W || py < -u || py > H) continue;
          const cell = {
            x: px, y: py,
            ch: grid.lines[gy][gx], col: grid.palette[ci],
            axis: (px * 0.8 + py * 0.6) / diag,
            spring: rand() < 0.1 ? { ox: 0, oy: 0, vx: 0, vy: 0 } : null,
          };
          cells.push(cell);
          stamp(bctx, sprite(cell.ch, cell.col), px, py);
        }
      }
    };

    const springStep = (cell, dt) => {
      const s = cell.spring;
      const cellW = CELL_ASPECT * u;
      const cx = cell.x + cellW * 0.5;
      const cy = cell.y + u * 0.5;
      let ax = -SPRING_K * s.ox - SPRING_C * s.vx;
      let ay = -SPRING_K * s.oy - SPRING_C * s.vy;
      let flare = 1;
      if (pointer.strength > 0.02) {
        const dx = cx - pointer.x;
        const dy = cy - pointer.y;
        const d2 = dx * dx + dy * dy;
        const R2 = POINTER_RADIUS * POINTER_RADIUS;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const fall = 1 - d / POINTER_RADIUS;
          const push = 3200 * fall * fall * pointer.strength;
          ax += (dx / d) * push;
          ay += (dy / d) * push;
          flare = 1 + 0.55 * fall * pointer.strength;
        }
      }
      s.vx += ax * dt;
      s.vy += ay * dt;
      s.ox += s.vx * dt;
      s.oy += s.vy * dt;
      return flare;
    };

    const drawFx = (now, dt) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) *
        Math.min(1, dt * 5);

      // the swipe: a soft diagonal front on a fixed cycle
      const cycleT = now % SWIPE_PERIOD;
      if (cycleT < SWIPE_DUR) {
        const head = -0.12 + 1.24 * (cycleT / SWIPE_DUR);
        for (const cell of cells) {
          const dd = (cell.axis - head) / 0.05;
          if (dd > 2.6 || dd < -2.6) continue;
          const f = 1 + 0.9 * Math.exp(-(dd * dd));
          const b = bucket(f, 0.07);
          if (b <= 1) continue;
          stamp(ctx, sprite(cell.ch, shade(cell.col, b)), cell.x, cell.y);
        }
      }

      // a soft flare rides the pointer between stamps
      if (pointer.strength > 0.02) {
        const rad = POINTER_RADIUS * 1.15;
        const grad = ctx.createRadialGradient(
          pointer.x, pointer.y, 0,
          pointer.x, pointer.y, rad,
        );
        grad.addColorStop(0, `rgba(240,235,210,${0.07 * pointer.strength})`);
        grad.addColorStop(1, "rgba(240,235,210,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(pointer.x - rad, pointer.y - rad, rad * 2, rad * 2);
      }

      // the mouse deformation, at still posts
      for (const cell of cells) {
        if (!cell.spring) continue;
        const s = cell.spring;
        const flare = springStep(cell, dt);
        const moved = Math.abs(s.ox) > 0.4 || Math.abs(s.oy) > 0.4;
        if (!moved && flare === 1) continue;
        stampAlpha(sprite(cell.ch, "#000000"), cell.x, cell.y,
          Math.min(0.9, Math.hypot(s.ox, s.oy) / 14 + 0.25));
        const b = bucket(flare, 0.06);
        stamp(ctx, sprite(cell.ch, b === 1 ? cell.col : shade(cell.col, b)),
          cell.x + s.ox, cell.y + s.oy);
      }
    };

    buildBase();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastStart = 0;
    let lastStamp = 0;
    if (!reduced) {
      const loop = () => {
        const now = performance.now() / 1000;
        if (visible && now - lastStart >= 0.033) {
          const dt = Math.min(0.033, lastStamp ? now - lastStamp : 0.016);
          lastStamp = now;
          lastStart = now;
          drawFx(now, dt);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const onMove = (e) => {
      const rect = stage.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      window.addEventListener("blur", onLeave);
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
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [opacity]);

  return (
    <div className="candle-stack" style={{ opacity }} aria-hidden="true">
      <canvas ref={baseRef} className="sprinkle-fill" />
      <canvas ref={fxRef} className="sprinkle-fill" />
    </div>
  );
}
