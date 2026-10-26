import { useEffect, useRef } from "react";
import grid from "../assets/candle-sky-grid.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  CandleField: the Stock page backdrop. Nick's own generated
  candle sky (a galaxy, nebula banks, and crystal candlesticks
  standing in for stars), converted with the site converter.

  Life, per Nick's direction after the first quiet version:
  it is a starfield, so it should sparkle harder than the
  grass does. A large seeded share of the cells twinkles on
  sine curves, dozens of heroes flare bright, and three
  nebula glows breathe out of phase underneath. The sky is
  also mouse-reactive: cells near the pointer are pushed
  radially away and lit up, each riding its own spring, so
  when the pointer leaves they overshoot and rubber-band
  back into place.

  Architecture follows WindGrass: one canvas, an offscreen
  base stamped from sprites, every frame blits the base back
  (so no stamp ever needs erasing by hand) and re-stamps the
  animated cells at their current shade and position. The
  twinkle and reactive populations are disjoint. The grid is
  cover-fit to the viewport and center-cropped; it never
  tiles. Reduced motion draws the base once, no springs, no
  twinkle.
*/
const CELL_ASPECT = 0.6;
const SEED = 133233;
const POINTER_RADIUS = 230;
const SPRING_K = 110;
const SPRING_C = 8.5;

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

const GLOWS = [
  { fx: 0.16, fy: 0.3, r: 0.42, hue: "96,64,170", period: 12, phase: 0.0 },
  { fx: 0.82, fy: 0.62, r: 0.46, hue: "52,84,150", period: 16, phase: 2.1 },
  { fx: 0.55, fy: 0.88, r: 0.4, hue: "130,58,128", period: 10, phase: 4.2 },
];

export default function CandleField({ opacity = 0.6 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let W = 0;
    let H = 0;
    let u = 0;
    let visible = true;
    let baseImg = null;
    let twinkles = [];
    let reactives = [];
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

    const buildBase = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      // cover-fit: one grid, scaled to cover, centered, cropped
      u = Math.max(W / (grid.cols * CELL_ASPECT), H / grid.rows);
      const cellW = CELL_ASPECT * u;
      const ox = (W - grid.cols * cellW) / 2;
      const oy = (H - grid.rows * u) / 2;
      spriteCache.clear();

      const cells = [];
      for (let y = 0; y < grid.rows; y++) {
        for (let x = 0; x < grid.cols; x++) {
          const ci = grid.cells[y][x];
          if (ci < 0) continue;
          const px = ox + x * cellW;
          const py = oy + y * u;
          if (px < -cellW || px > W || py < -u || py > H) continue;
          cells.push({ x: px, y: py, ch: grid.lines[y][x], col: grid.palette[ci] });
        }
      }

      baseImg = document.createElement("canvas");
      baseImg.width = canvas.width;
      baseImg.height = canvas.height;
      const bg = baseImg.getContext("2d");
      bg.scale(dpr, dpr);
      bg.fillStyle = "#0a0a09";
      bg.fillRect(0, 0, W, H);
      for (const cell of cells) {
        stamp(bg, sprite(cell.ch, cell.col), cell.x, cell.y);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);

      // Seeded populations, disjoint: reactive cells get picked
      // first, twinkles draw from what remains.
      const rand = mulberry32(SEED);
      reactives = [];
      const reactiveSet = new Set();
      for (const cell of cells) {
        if (rand() < 0.14) {
          reactives.push({ cell, ox: 0, oy: 0, vx: 0, vy: 0 });
          reactiveSet.add(cell);
        }
      }
      twinkles = [];
      for (const cell of cells) {
        if (reactiveSet.has(cell)) continue;
        if (rand() < 0.075) {
          twinkles.push({
            cell,
            phase: rand() * 6.28,
            speed: 0.4 + rand() * 0.75,
            amp: 0.2 + rand() * 0.25,
            hero: false,
          });
        }
      }
      for (let i = 0; i < 64 && cells.length; i++) {
        const cell = cells[(rand() * cells.length) | 0];
        if (reactiveSet.has(cell)) continue;
        twinkles.push({
          cell,
          phase: rand() * 6.28,
          speed: 0.7 + rand() * 1.2,
          amp: 0.5 + rand() * 0.35,
          hero: true,
        });
      }
    };

    const draw = (now, dt) => {
      if (!baseImg) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // pointer presence eases in and out; the springs give
      // the rubber band, this only gates the push force
      pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) *
        Math.min(1, dt * 5);

      // breathing: slow nebula glows swelling out of phase
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const g of GLOWS) {
        const s = 0.5 + 0.5 * Math.sin((now / g.period) * 6.28 + g.phase);
        const a = 0.03 + 0.075 * s;
        const rad = g.r * W * (0.92 + 0.1 * s);
        const grad = ctx.createRadialGradient(
          g.fx * W, g.fy * H, 0,
          g.fx * W, g.fy * H, rad,
        );
        grad.addColorStop(0, `rgba(${g.hue},${a})`);
        grad.addColorStop(1, `rgba(${g.hue},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
      // a soft flare rides the pointer so the interaction
      // reads even between stamps
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
      ctx.restore();

      // twinkle: regulars pulse brighter over the base (a
      // transparent sprite cannot darken what is under it, so
      // the dim half of their cycle is left to the base);
      // heroes run the full cycle with a wipe, so they truly
      // dim as well as flare
      const cellW0 = CELL_ASPECT * u;
      for (const t of twinkles) {
        const b = bucket(1 + t.amp * Math.sin(now * t.speed + t.phase), 0.06);
        if (t.hero) {
          if (b === 1) continue;
          ctx.fillStyle = "#0a0a09";
          ctx.fillRect(t.cell.x - 0.5, t.cell.y - 0.5, cellW0 + 1, u + 1);
          stamp(ctx, sprite(t.cell.ch, shade(t.cell.col, b)), t.cell.x, t.cell.y);
        } else if (b > 1) {
          stamp(ctx, sprite(t.cell.ch, shade(t.cell.col, b)), t.cell.x, t.cell.y);
        }
      }

      // reactive springs: pushed by the pointer, pulled home
      // by the spring; overshoot is the rubber band
      const cellW = CELL_ASPECT * u;
      const R2 = POINTER_RADIUS * POINTER_RADIUS;
      for (const r of reactives) {
        const cx = r.cell.x + cellW * 0.5;
        const cy = r.cell.y + u * 0.5;
        let ax = -SPRING_K * r.ox - SPRING_C * r.vx;
        let ay = -SPRING_K * r.oy - SPRING_C * r.vy;
        let flare = 1;
        if (pointer.strength > 0.02) {
          const dx = cx - pointer.x;
          const dy = cy - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const fall = 1 - d / POINTER_RADIUS;
            const push = 3200 * fall * fall * pointer.strength;
            ax += (dx / d) * push;
            ay += (dy / d) * push;
            flare = 1 + 0.55 * fall * pointer.strength;
          }
        }
        r.vx += ax * dt;
        r.vy += ay * dt;
        r.ox += r.vx * dt;
        r.oy += r.vy * dt;
        const moved = Math.abs(r.ox) > 0.4 || Math.abs(r.oy) > 0.4;
        if (!moved && flare === 1) continue;
        // wipe the home cell so the glyph does not double,
        // then stamp at the displaced position, lit by
        // proximity
        ctx.fillStyle = "#0a0a09";
        ctx.fillRect(r.cell.x - 0.5, r.cell.y - 0.5, cellW + 1, u + 1);
        const b = bucket(flare, 0.06);
        stamp(
          ctx,
          sprite(r.cell.ch, b === 1 ? r.cell.col : shade(r.cell.col, b)),
          r.cell.x + r.ox,
          r.cell.y + r.oy,
        );
      }
    };

    buildBase();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastStart = 0;
    let lastStamp = 0;
    if (!reduced) {
      const loop = () => {
        const now = performance.now() / 1000;
        if (visible && now - lastStart >= 0.055) {
          const dt = Math.min(0.033, lastStamp ? now - lastStamp : 0.016);
          lastStamp = now;
          lastStart = now;
          draw(now, dt);
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
    <canvas
      ref={ref}
      className="sprinkle-fill"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
