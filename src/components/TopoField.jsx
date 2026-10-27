import { useEffect, useRef } from "react";
import topoGrid from "../assets/ma-topo-grid.json";

/*
  TopoField: the Dunkin project page's backdrop (Nick,
  Oct 27, 2026). The sprinkle field read well but sat in a
  different medium from the ASCII art everywhere else on
  the page, so the backdrop is now the project itself,
  drawn in the site's own fabric: a topographic contour
  map of Massachusetts and its region, generated to a
  three-color spec Nick approved (Massachusetts in amber
  gold, the surrounding states in bronze, the Atlantic in
  chart blue bathymetry, all on solid black), then run
  through tools/ascii-converter at 440 columns, fine ramp,
  peak sampling, gamma 1.4 and color gain 0.85 so the
  dense bright blocks keep their line texture and the
  gold lands on the approved amber. Field brightness is
  0.72, lifted from 0.5 on Nick's live review of v3.65.
  The first-generation single-state map (grid D) ran in
  v3.65 and lives in stage2-research/topo/ with the rest
  of the trail.

  Rendering follows the WindGrass discipline: ONE canvas,
  an offscreen base stamped once from pre-rendered glyph
  sprites, and per-frame work only where something changed.

  The bulge (Nick's idea, behavior approved Oct 27, 2026):
  a raised-relief feel under the cursor. Inside a soft
  radius the glyphs step UP the fine ramp toward heavier
  characters and their color brightens within its own
  family: warm cells warm toward bright gold, ocean cells
  lighten toward the index blue, so the bulge never
  repaints one region in another region's color. The map
  never moves, so the coastline stays rock steady.
  Attack is quick, settle-back runs about half a second,
  and there is no trail. Desktop-class pointers on wide
  screens only; touch, narrow screens, and reduced motion
  get the static field. Three very slow frames disable the
  bulge for the session rather than fight the machine.
*/
const CELL_ASPECT = 0.6;
// The converter's fine ramp, ordered light to heavy. A
// bulge boost walks a cell's glyph up this string.
const RAMP_FINE =
  " .'`^\\\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const GOLD = [232, 201, 93]; // --gold-bright #e8c95d
const SEA = [74, 144, 171]; // chart index blue #4a90ab
const RADIUS = 160;
const LEVELS = 7; // boost quantize steps, 0 is rest
const BG = "#0a0a09";

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// A cell's color at a boost level: brightened and shifted
// toward its own family's light tone (gold for warm cells,
// index blue for ocean cells), scaled by the level's share
// of full boost. The family test keys on green over red:
// the converter's coarse blue quantization (four levels)
// zeroes the blue channel of diluted bathymetry, leaving
// dark teal-green cells whose blue reads zero. Those are
// ocean all the same, and keying on blue over red sent
// them to the gold target on the live page (Nick's catch,
// Oct 27, 2026). Warm land colors always carry red at or
// above green, so green over red separates the families
// cleanly.
function boostColor(col, lvl) {
  const t = lvl / LEVELS;
  const [r, g, b] = hexRgb(col);
  const cool = g > r;
  const target = cool ? SEA : GOLD;
  const warm = (cool ? 0.55 : 0.7) * t;
  const bright = 1 + 0.5 * t;
  const mix = (c, targetC) =>
    Math.min(255, Math.round((c + (targetC - c) * warm) * bright));
  return `rgb(${mix(r, target[0])},${mix(g, target[1])},${mix(b, target[2])})`;
}

export default function TopoField({ opacity = 0.72 }) {
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
    let cells = [];
    let gridPos = null; // grid index -> cell index, -1 empty
    let boost = null; // per-cell boost, 0..1
    let baseImg = null;
    let hot = new Set(); // cell indices stamped last frame
    let pointer = null; // {x, y} in CSS px, null when away
    let bulgeOn = false;
    let bulgeDisabled = false;
    let slowFrames = 0;
    let last = performance.now();

    // --- glyph sprites, top-left anchored like WindGrass ---
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
      const grid = topoGrid;
      // Cover at every aspect, so the field fills the
      // screen the way the sprinkles did. Wide screens see
      // the whole state; portrait phones crop to the central
      // counties and read it as full-bleed topo texture. A
      // fit-width portrait pass left the map floating in a
      // band mid-screen (caught in QA, Oct 27, 2026).
      u = Math.max(W / (grid.cols * CELL_ASPECT), H / grid.rows);
      const gridW = grid.cols * CELL_ASPECT * u;
      const gridH = grid.rows * u;
      const ox = (W - gridW) / 2;
      const oy = (H - gridH) / 2;
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
          const col = grid.palette[ci];
          const [r, g, b] = hexRgb(col);
          // Near-black palette entries are invisible on the
          // page background; stamping them buys nothing.
          if (r * 0.2126 + g * 0.7152 + b * 0.0722 < 12) continue;
          const ch = line[gx];
          const ri = RAMP_FINE.indexOf(ch);
          gridPos[gy * grid.cols + gx] = cells.length;
          cells.push({
            x: ox + gx * cellW,
            y: oy + gy * u,
            gx,
            gy,
            ch,
            col,
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

      // Candidate cells: the grid bounding box of the radius.
      const grid = topoGrid;
      const cellW = CELL_ASPECT * u;
      const targets = new Map();
      if (pointer) {
        const gx0 = Math.max(0, Math.floor((pointer.x - RADIUS - ((W - grid.cols * cellW) / 2)) / cellW));
        const gx1 = Math.min(grid.cols - 1, Math.ceil((pointer.x + RADIUS - ((W - grid.cols * cellW) / 2)) / cellW));
        const gy0 = Math.max(0, Math.floor((pointer.y - RADIUS - ((H - grid.rows * u) / 2)) / u));
        const gy1 = Math.min(grid.rows - 1, Math.ceil((pointer.y + RADIUS - ((H - grid.rows * u) / 2)) / u));
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
            targets.set(idx, t * t * (3 - 2 * t)); // smoothstep
          }
        }
      }

      // Ease every hot or targeted cell toward its target.
      const active = new Set([...hot, ...targets.keys()]);
      if (active.size === 0) return;
      const nextHot = new Set();
      const stampList = [];
      for (const idx of active) {
        const target = targets.get(idx) || 0;
        const b = boost[idx];
        const k =
          target > b
            ? 1 - Math.exp(-dt / 0.045) // quick attack
            : 1 - Math.exp(-dt / 0.16); // half-second settle
        let nb = b + (target - b) * k;
        if (target === 0 && nb < 0.02) nb = 0;
        boost[idx] = nb;
        const lvl = Math.round(nb * LEVELS);
        if (lvl > 0) {
          nextHot.add(idx);
          stampList.push([idx, lvl]);
        } else if (hot.has(idx)) {
          stampList.push([idx, 0]); // needs one clearing pass
        }
      }

      // Repaint: base back, wipe the stamped cells, restamp
      // them boosted. Same two-pass shape as the wind.
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
        const step = Math.round((lvl / LEVELS) * 14);
        const ch = RAMP_FINE[Math.min(RAMP_FINE.length - 1, cell.ri + step)];
        const sp = sprite(ch, boostColor(cell.col, lvl));
        ctx.drawImage(sp.c, cell.x - 2, cell.y - 2, sp.w, sp.h);
      }
      hot = nextHot;

      const cost = performance.now() - t0;
      if (cost > 120) {
        slowFrames += 1;
        if (slowFrames >= 3) {
          bulgeDisabled = true;
          bulgeOn = false;
          // leave the field in its clean static state
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
