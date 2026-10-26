import { useEffect, useRef } from "react";
import grid from "../assets/candle-sky-grid.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  CandleField, third architecture (v3.44). Two stacked
  canvases, as approved: the base canvas holds the anchored
  sky and breathes through a CSS filter on the element; the
  FX canvas above only ever draws glyph-shaped marks, so
  rectangular artifacts have no mechanism to exist.

  The v3.43 parallax tore the art apart, and Nick called the
  fix: objects must never be parallaxed. The first build
  split the field by per-cell brightness, so every bright
  candle's core drifted out of its own dimmer edges. The
  rule now is object-first:

  - The grid is segmented before anything moves. Candle
    class cells (saturated green or red, or near white) form
    their own connected components: those are the candles.
  - Any full-grid component containing even one candle
    class cell is an OBJECT. Objects are anchored in the
    base, whole, forever.
  - Parallax belongs only to SPECKS: full-grid components
    of four cells or fewer with no candle class and no
    nebula in them, distant star dust that cannot be torn
    because it has no structure to tear. About 1,100 cells.
  - Flicker rides the largest green and red candle
    components, stamped at their anchored posts.
  - Nebula light waves sweep the dim blue cells, which live
    in the anchored continent and are lit in place.
  - Springs still push cells around the pointer; anchored
    cells fade at their post in their own glyph shape and
    land displaced, specks add the offset to their drift.

  Reduced motion: base sky only, still and unfiltered.
*/
const CELL_ASPECT = 0.6;
const SEED = 133233;
const POINTER_RADIUS = 230;
const SPRING_K = 110;
const SPRING_C = 8.5;
const DRIFT_VX = -3.4; // px per second, specks only
const DRIFT_VY = 0.55;

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

const rgbOf = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});
const lumOf = ({ r, g, b }) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const isCandleRGB = ({ r, g, b }) =>
  (g > r + 25 && g > b + 25 && g >= 85) ||
  (r > g + 25 && r > b + 25 && r >= 85) ||
  Math.min(r, g, b) >= 165;
const isNebulaRGB = (rgb) => rgb.b > rgb.r && rgb.b > rgb.g && lumOf(rgb) < 0.34;

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
    let specks = []; // [{ cells, mult }]
    let flickerCells = [];
    let nebulaCells = [];
    let farReactive = [];
    let giants = [];
    const pointer = { x: -9999, y: -9999, active: false, strength: 0 };
    let waves = [];
    let nextWaveAt = 5;

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
      u = Math.max(W / (grid.cols * CELL_ASPECT), H / grid.rows);
      const cellW = CELL_ASPECT * u;
      const ox = (W - grid.cols * cellW) / 2;
      const oy = (H - grid.rows * u) / 2;
      spriteCache.clear();

      const paletteRGB = grid.palette.map(rgbOf);
      const all = [];
      const byCoord = new Map();
      for (let gy = 0; gy < grid.rows; gy++) {
        for (let gx = 0; gx < grid.cols; gx++) {
          const ci = grid.cells[gy][gx];
          if (ci < 0) continue;
          const px = ox + gx * cellW;
          const py = oy + gy * u;
          if (px < -cellW || px > W || py < -u || py > H) continue;
          const rgb = paletteRGB[ci];
          const cell = {
            x: px, y: py, gx, gy,
            ch: grid.lines[gy][gx], col: grid.palette[ci],
            candle: isCandleRGB(rgb),
            nebula: isNebulaRGB(rgb),
            speck: -1, flicker: -1, spring: null, lastB: 1,
          };
          all.push(cell);
          byCoord.set(`${gx},${gy}`, cell);
        }
      }

      // full-grid components: the object map of the sky
      const componentsOf = (cells, keyFn) => {
        const inSet = new Set(cells);
        const seenSet = new Set();
        const comps = [];
        for (const cell of cells) {
          if (seenSet.has(cell)) continue;
          const comp = [];
          const stack = [cell];
          seenSet.add(cell);
          while (stack.length) {
            const c = stack.pop();
            comp.push(c);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const n = keyFn(c.gx + dx, c.gy + dy);
              if (n && inSet.has(n) && !seenSet.has(n)) {
                seenSet.add(n);
                stack.push(n);
              }
            }
          }
          comps.push(comp);
        }
        return comps;
      };
      const fullComps = componentsOf(all, (x, y) => byCoord.get(`${x},${y}`));

      // specks: tiny, candle-free, nebula-free components
      const rand = mulberry32(SEED);
      specks = [];
      const speckSet = new Set();
      for (const comp of fullComps) {
        if (comp.length > 4) continue;
        if (comp.some((c) => c.candle || c.nebula)) continue;
        const idx = specks.length;
        specks.push({ cells: comp, mult: 0.7 + rand() * 0.6 });
        for (const c of comp) {
          c.speck = idx;
          speckSet.add(c);
        }
      }

      // flicker: largest green or red candle-class components
      const candleCells = all.filter((c) => c.candle);
      const candleComps = componentsOf(candleCells, (x, y) => byCoord.get(`${x},${y}`))
        .filter((comp) => comp.length >= 20)
        .map((comp) => {
          let r = 0, g = 0, b = 0;
          for (const c of comp) {
            const rgb = paletteRGB[grid.cells[c.gy][c.gx]];
            r += rgb.r; g += rgb.g; b += rgb.b;
          }
          return { comp, hue: g > r && g > b ? "green" : r > g && r > b ? "red" : "white" };
        })
        .filter(({ hue }) => hue === "green" || hue === "red")
        .sort((a, b) => b.comp.length - a.comp.length)
        .slice(0, 16);
      const rand0 = mulberry32(SEED + 7);
      giants = candleComps.map(() => ({
        phase: rand0() * 6.28,
        speed: 0.9 + rand0() * 0.5,
      }));
      flickerCells = [];
      candleComps.forEach(({ comp }, gi) => {
        for (const c of comp) {
          c.flicker = gi;
          flickerCells.push(c);
        }
      });

      nebulaCells = all.filter((c) => c.nebula && !speckSet.has(c));
      const diag = Math.hypot(W, H) || 1;
      for (const c of nebulaCells) {
        c.axis = (c.x * 0.8 + c.y * 0.6) / diag;
      }

      // anchored sky onto the base: everything but specks
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.fillStyle = "#0a0a09";
      bctx.fillRect(0, 0, W, H);
      for (const cell of all) {
        if (speckSet.has(cell)) continue;
        stamp(bctx, sprite(cell.ch, cell.col), cell.x, cell.y);
      }

      // springs on a seeded tenth; each cell is animated by
      // exactly one pass, in priority order
      farReactive = [];
      for (const cell of all) {
        if (rand() < 0.1) {
          cell.spring = { ox: 0, oy: 0, vx: 0, vy: 0 };
          if (cell.speck < 0 && cell.flicker < 0 && !cell.nebula) {
            farReactive.push(cell);
          }
        }
      }
      waves = [];
      nextWaveAt = performance.now() / 1000 + 5;
    };

    const springStep = (cell, dt, cx, cy) => {
      const s = cell.spring;
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
      const cellW = CELL_ASPECT * u;

      pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) *
        Math.min(1, dt * 5);

      // breathing and sway ride the base element itself
      const breathe =
        1 +
        0.2 * Math.sin((now / 14) * 6.28) +
        0.05 * Math.sin((now / 5.3) * 6.28 + 1.7);
      baseCanvas.style.filter = `brightness(${breathe.toFixed(3)})`;
      const sway = 7 * Math.sin((now / 55) * 6.28);
      baseCanvas.style.transform = `translateX(${sway.toFixed(2)}px) scale(1.03)`;

      // soft flare at the pointer
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

      // nebula light waves, lit in place
      if (now >= nextWaveAt) {
        waves.push({ t0: now, dur: 4.5 });
        nextWaveAt = now + 8 + Math.random() * 7;
      }
      waves = waves.filter((w) => now - w.t0 < w.dur);
      for (const w of waves) {
        const p = (now - w.t0) / w.dur;
        const head = -0.15 + 1.3 * p;
        const env = Math.pow(Math.sin(Math.PI * p), 1.5);
        for (const c of nebulaCells) {
          const dd = (c.axis - head) / 0.055;
          const f = 1 + 1.1 * env * Math.exp(-(dd * dd));
          const b = bucket(f, 0.08);
          if (b <= 1) continue;
          stamp(ctx, sprite(c.ch, shade(c.col, b)), c.x, c.y);
        }
      }

      // candle flicker at anchored posts
      for (const cell of flickerCells) {
        const g = giants[cell.flicker];
        const t = now * g.speed;
        let f =
          1 +
          0.17 *
            (0.6 * Math.sin(t * 8.3 + g.phase) +
              0.4 * Math.sin(t * 19.7 + g.phase * 1.7));
        if (cell.spring) {
          const flare = springStep(cell, dt, cell.x + cellW * 0.5, cell.y + u * 0.5);
          f *= flare;
          const s = cell.spring;
          const moved = Math.abs(s.ox) > 0.4 || Math.abs(s.oy) > 0.4;
          if (moved) {
            stampAlpha(sprite(cell.ch, "#000000"), cell.x, cell.y,
              Math.min(0.9, Math.hypot(s.ox, s.oy) / 14 + 0.25));
          }
          const b = bucket(Math.max(0.55, f), 0.05);
          stamp(ctx, sprite(cell.ch, b === 1 ? cell.col : shade(cell.col, b)),
            cell.x + s.ox, cell.y + s.oy);
          cell.lastB = b;
        } else {
          const b = bucket(Math.max(0.55, f), 0.05);
          if (b === cell.lastB) continue;
          cell.lastB = b;
          if (b < 1) {
            stampAlpha(sprite(cell.ch, "#000000"), cell.x, cell.y,
              Math.min(0.85, (1 - b) * 1.6));
          }
          stamp(ctx, sprite(cell.ch, b === 1 ? cell.col : shade(cell.col, b)), cell.x, cell.y);
        }
      }

      // specks: the only things allowed to travel
      const spanX = W + cellW * 2;
      const spanY = H + u * 2;
      for (const speck of specks) {
        const dxT = now * DRIFT_VX * speck.mult;
        const dyT = now * DRIFT_VY * speck.mult;
        for (const cell of speck.cells) {
          let px = (cell.x + dxT) % spanX;
          if (px < 0) px += spanX;
          px -= cellW;
          let py = (cell.y + dyT) % spanY;
          if (py < 0) py += spanY;
          py -= u;
          if (cell.spring) {
            const flare = springStep(cell, dt, px + cellW * 0.5, py + u * 0.5);
            const s = cell.spring;
            const moved = Math.abs(s.ox) > 0.4 || Math.abs(s.oy) > 0.4;
            if (moved) {
              stampAlpha(sprite(cell.ch, "#000000"), px, py,
                Math.min(0.9, Math.hypot(s.ox, s.oy) / 14 + 0.25));
            }
            const b = bucket(flare, 0.06);
            stamp(ctx, sprite(cell.ch, b === 1 ? cell.col : shade(cell.col, b)),
              px + s.ox, py + s.oy);
          } else {
            stamp(ctx, sprite(cell.ch, cell.col), px, py);
          }
        }
      }

      // remaining anchored cells with springs
      for (const cell of farReactive) {
        const s = cell.spring;
        const flare = springStep(cell, dt, cell.x + cellW * 0.5, cell.y + u * 0.5);
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
    let interval = 0.033;
    if (!reduced) {
      const loop = () => {
        const now = performance.now() / 1000;
        if (visible && now - lastStart >= interval) {
          const dt = Math.min(0.033, lastStamp ? now - lastStamp : 0.016);
          lastStamp = now;
          lastStart = now;
          const t0 = performance.now();
          drawFx(now, dt);
          const cost = performance.now() - t0;
          interval = cost > 22 ? 0.05 : 0.033;
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
