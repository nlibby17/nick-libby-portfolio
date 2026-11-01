import { useEffect, useRef } from "react";
import chicagoGrid from "../assets/chicago-grid.json";

/*
  RouteField: the Cyclistic project page's backdrop (Nick,
  Nov 1, 2026). A stylized Chicago lakefront street map
  (AI-drawn at Nick's direction, third generation: bold
  sparse streets, wave-filled lake, compass rose) run
  through tools/ascii-converter at 380 columns, blade ramp.

  Color discipline (Nick's call, Nov 1, 2026): the source
  waves arrive bright blue; at build time every palette
  entry is remapped into one of two families, the same
  two-family treatment TopoField uses. Blue-dominant cells
  become dim steel blue water; everything else becomes
  silver streets.

  The page's motion is the Dunkin page's spotlight, ported
  at Nick's direction the same day (an animated route that
  traced the shoreline was tried first and deleted by his
  call: hand-placed, it drifted off the drawn roads). In a
  soft radius under the cursor the glyphs step UP the
  blade ramp toward heavier characters and brighten inside
  their own family: silver warms toward bright silver,
  water lightens toward pale steel, and neither repaints
  the other. Attack is quick, settle-back about half a
  second, no trail. Desktop-class pointers on wide screens
  only; touch, narrow screens, and reduced motion get the
  static field. Three very slow frames disable the
  spotlight for the session.

  Rendering follows the TopoField discipline: one canvas,
  an offscreen base stamped once from glyph sprites, and
  per-frame work only inside the spotlight.
*/
const CELL_ASPECT = 0.6;
const RAMP_BLADE = " .·:'|/\\!1ljrfxt+*%#@";
const SILVER = [238, 242, 245];
const STEEL = [110, 160, 205];
const RADIUS = 160;
const LEVELS = 7; // boost quantize steps, 0 is rest
const BG = "#0a0a09";

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Two-family remap: blue-dominant palette entries are the
// lake waves and become dim steel; the rest are streets
// and compass line work, held to silver.
function remapRgb(hex) {
  const [r, g, b] = hexRgb(hex);
  if (b > r + 30 && b >= g) {
    return [
      Math.round(r * 0.3),
      Math.round(g * 0.48),
      Math.round(b * 0.6),
    ];
  }
  const s = 0.78;
  return [Math.round(r * s), Math.round(g * s), Math.round(b * s)];
}

const css = ([r, g, b]) => `rgb(${r},${g},${b})`;

// A cell's color at a boost level: brightened and shifted
// toward its own family's light tone. The family test keys
// on the remapped values: water carries blue well above
// red, silver stays near neutral.
function boostColor(rgbArr, lvl) {
  const t = lvl / LEVELS;
  const [r, g, b] = rgbArr;
  const water = b - r > 40;
  const target = water ? STEEL : SILVER;
  const warm = (water ? 0.55 : 0.65) * t;
  const bright = 1 + 0.5 * t;
  const mix = (c, targetC) =>
    Math.min(255, Math.round((c + (targetC - c) * warm) * bright));
  return `rgb(${mix(r, target[0])},${mix(g, target[1])},${mix(b, target[2])})`;
}

export default function RouteField({ opacity = 0.7 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const layer = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let visible = true;
    let W = 0;
    let H = 0;
    let u = 0;
    let ox = 0;
    let oy = 0;
    let cells = [];
    let gridPos = null;
    let boost = null;
    let baseImg = null;
    let hot = new Set();
    let pointer = null;
    let bulgeOn = false;
    let bulgeDisabled = false;
    let slowFrames = 0;
    let last = performance.now();

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

    const build = () => {
      W = layer.clientWidth;
      H = window.innerHeight;
      if (!W || !H) return;
      const grid = chicagoGrid;
      u = Math.max(W / (grid.cols * CELL_ASPECT), H / grid.rows);
      const gridW = grid.cols * CELL_ASPECT * u;
      const gridH = grid.rows * u;
      ox = (W - gridW) / 2;
      oy = (H - gridH) / 2;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      spriteCache.clear();

      cells = [];
      gridPos = new Int32Array(grid.cols * grid.rows).fill(-1);
      const cellW = CELL_ASPECT * u;
      for (let gy = 0; gy < grid.rows; gy++) {
        const rowCells = grid.cells[gy];
        const line = grid.lines[gy];
        for (let gx = 0; gx < grid.cols; gx++) {
          const ci = rowCells[gx];
          if (ci < 0) continue;
          const rgbArr = remapRgb(grid.palette[ci]);
          const [r, g, b] = rgbArr;
          if (r * 0.2126 + g * 0.7152 + b * 0.0722 < 12) continue;
          const ch = line[gx];
          const ri = RAMP_BLADE.indexOf(ch);
          gridPos[gy * grid.cols + gx] = cells.length;
          cells.push({
            x: ox + gx * cellW,
            y: oy + gy * u,
            gx,
            gy,
            ch,
            col: css(rgbArr),
            rgbArr,
            ri: ri < 0 ? 0 : ri,
          });
        }
      }
      boost = new Float32Array(cells.length);
      hot = new Set();

      baseImg = document.createElement("canvas");
      baseImg.width = canvas.width;
      baseImg.height = canvas.height;
      const bg = baseImg.getContext("2d");
      bg.scale(dpr, dpr);
      bg.fillStyle = BG;
      bg.fillRect(0, 0, W, H);
      for (const cell of cells) {
        const sp = sprite(cell.ch, cell.col);
        bg.drawImage(sp.c, cell.x - 2, cell.y - 2, sp.w, sp.h);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);

      const fine = window.matchMedia(
        "(hover: hover) and (pointer: fine)",
      ).matches;
      bulgeOn = fine && W >= 1024 && !bulgeDisabled;
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || !baseImg || !bulgeOn || !boost) return;
      const t0 = performance.now();

      const grid = chicagoGrid;
      const cellW = CELL_ASPECT * u;
      const targets = new Map();
      if (pointer) {
        const gx0 = Math.max(0, Math.floor((pointer.x - RADIUS - ox) / cellW));
        const gx1 = Math.min(grid.cols - 1, Math.ceil((pointer.x + RADIUS - ox) / cellW));
        const gy0 = Math.max(0, Math.floor((pointer.y - RADIUS - oy) / u));
        const gy1 = Math.min(grid.rows - 1, Math.ceil((pointer.y + RADIUS - oy) / u));
        for (let gy = gy0; gy <= gy1; gy++) {
          for (let gx = gx0; gx <= gx1; gx++) {
            const idx = gridPos[gy * grid.cols + gx];
            if (idx < 0) continue;
            const cell = cells[idx];
            const dx = cell.x + cellW / 2 - pointer.x;
            const dy = cell.y + u / 2 - pointer.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d >= RADIUS) continue;
            const t = 1 - d / RADIUS;
            targets.set(idx, t * t * (3 - 2 * t));
          }
        }
      }

      const active = new Set([...hot, ...targets.keys()]);
      if (active.size === 0) return;
      const nextHot = new Set();
      const stampList = [];
      for (const idx of active) {
        const target = targets.get(idx) || 0;
        const b = boost[idx];
        const k =
          target > b
            ? 1 - Math.exp(-dt / 0.045)
            : 1 - Math.exp(-dt / 0.16);
        let nb = b + (target - b) * k;
        if (target === 0 && nb < 0.02) nb = 0;
        boost[idx] = nb;
        const lvl = Math.round(nb * LEVELS);
        if (lvl > 0) {
          nextHot.add(idx);
          stampList.push([idx, lvl]);
        } else if (hot.has(idx)) {
          stampList.push([idx, 0]);
        }
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG;
      for (const [idx] of stampList) {
        const cell = cells[idx];
        ctx.fillRect(cell.x - 0.5, cell.y - 0.5, cellW + 1, u + 1);
      }
      for (const [idx, lvl] of stampList) {
        if (lvl === 0) continue;
        const cell = cells[idx];
        const step = Math.round((lvl / LEVELS) * 7);
        const ch = RAMP_BLADE[Math.min(RAMP_BLADE.length - 1, cell.ri + step)];
        const sp = sprite(ch, boostColor(cell.rgbArr, lvl));
        ctx.drawImage(sp.c, cell.x - 2, cell.y - 2, sp.w, sp.h);
      }
      hot = nextHot;

      const cost = performance.now() - t0;
      if (cost > 120) {
        slowFrames += 1;
        if (slowFrames >= 3) {
          bulgeDisabled = true;
          bulgeOn = false;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(baseImg, 0, 0);
        }
      } else if (slowFrames > 0) {
        slowFrames -= 1;
      }
    };

    const onMove = (e) => {
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      pointer = null;
    };

    build();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduced) {
      raf = requestAnimationFrame(frame);
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
      window.addEventListener("blur", onLeave);
    }
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "120px" },
    );
    io.observe(layer);
    const ro = new ResizeObserver(() => build());
    ro.observe(layer);
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
      className="ascii-field"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
