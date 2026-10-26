import { useEffect, useRef } from "react";
import grid from "../assets/candle-sky-grid.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  CandleField: the Stock page backdrop. Nick's own generated
  candle sky (a galaxy, nebula banks, and crystal candlesticks
  standing in for stars), converted with the site converter
  and brought to life lightly, per his ask: breathing, not
  busy. Three slow nebula glows swell and fade out of phase
  under the glyphs, and a seeded set of candle cells twinkles
  on sine curves, a couple dozen of them as brighter heroes.

  Architecture follows WindGrass: one canvas, an offscreen
  base stamped from sprites, frames blit the base back and
  re-stamp only the cells whose brightness bucket changed.
  The grid is cover-fit to the viewport and center-cropped;
  it never tiles. Reduced motion draws the base once.
*/
const CELL_ASPECT = 0.6;
const SEED = 133233;

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
  { fx: 0.16, fy: 0.3, r: 0.42, hue: "96,64,170", period: 17, phase: 0.0 },
  { fx: 0.82, fy: 0.62, r: 0.46, hue: "52,84,150", period: 23, phase: 2.1 },
  { fx: 0.55, fy: 0.88, r: 0.4, hue: "130,58,128", period: 13, phase: 4.2 },
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

      // twinkle population, seeded so the sky is the same
      // sky on every visit
      const rand = mulberry32(SEED);
      twinkles = [];
      for (const cell of cells) {
        if (rand() < 0.021) {
          twinkles.push({
            cell,
            phase: rand() * 6.28,
            speed: 0.25 + rand() * 0.5,
            amp: 0.16 + rand() * 0.22,
            last: 1,
          });
        }
      }
      for (let i = 0; i < 26 && cells.length; i++) {
        const cell = cells[(rand() * cells.length) | 0];
        twinkles.push({
          cell,
          phase: rand() * 6.28,
          speed: 0.4 + rand() * 0.6,
          amp: 0.45 + rand() * 0.25,
          last: 1,
        });
      }
    };

    const draw = (now) => {
      if (!baseImg) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // breathing: slow nebula glows swelling out of phase
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const g of GLOWS) {
        const s = 0.5 + 0.5 * Math.sin((now / g.period) * 6.28 + g.phase);
        const a = 0.02 + 0.045 * s;
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
      ctx.restore();

      // twinkle: re-stamp only cells whose shade changed
      const cellW = CELL_ASPECT * u;
      ctx.fillStyle = "#0a0a09";
      const changed = [];
      for (const t of twinkles) {
        const b = bucket(1 + t.amp * Math.sin(now * t.speed + t.phase), 0.06);
        if (b !== t.last) {
          t.last = b;
          changed.push(t);
        }
      }
      for (const t of changed) {
        ctx.fillRect(t.cell.x - 0.5, t.cell.y - 0.5, cellW + 1, u + 1);
      }
      for (const t of changed) {
        stamp(ctx, sprite(t.cell.ch, shade(t.cell.col, t.last)), t.cell.x, t.cell.y);
      }
    };

    buildBase();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastStart = 0;
    if (!reduced) {
      const loop = () => {
        const now = performance.now() / 1000;
        if (visible && now - lastStart >= 0.09) {
          lastStart = now;
          draw(now);
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
      className="sprinkle-fill"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
