import { useEffect, useRef } from "react";
import { ICON_REGISTRY } from "../lib/iconRegistry.js";
import {
  COLS as CUP_COLS,
  ROWS as CUP_ROWS,
  CELL_ASPECT,
  RAMP,
  IVORY,
  renderFrame,
} from "../lib/cupGeometry.js";
import { shade } from "../lib/discParticles.js";
import { glyphSprite } from "../lib/glyphAtlas.js";

/*
  OrbitRing: the homepage hero carousel (Nick's design,
  Oct 25-26, 2026). Project icons travel a tilted elliptical
  orbit over the sun backdrop. The locked rules:

  - Driven by lib/iconRegistry.js. Icons space themselves
    evenly by count, two opposite, three in thirds.
  - One full revolution in ORBIT_PERIOD_S seconds. Front
    crossings move left to right.
  - Icons hold a fixed pose. They do not spin on their own
    axes (the old hero cup spun; in the ring it is baked at
    one pose from its own geometry renderer).
  - Depth is told by scale, brightness, and draw order only.
    There is no front state and nothing keys off one.
  - Every icon carries a particle halo (Nick's design, final
    form Oct 26, 2026): a dense seeded field of small glyphs
    on plain elliptical orbits around the icon, colored as a
    pale kin of the icon's own colors, pointedly not the
    project's splash color. The math stays deliberately
    simple: constant speeds, no Kepler terms, no Doppler,
    sprites pre-rendered once and stamped without rotation.
    The heavyweight disc port (the sun field itself, with
    its per-particle transforms) looked right and lagged
    the page, so it was retired to the older commits by
    Nick's call; this halo matches its density, not its
    machinery. Back-arc particles hide behind the icon's
    own hit grid so the halo reads as passing behind.
  - Icons are not links. Labels ride under each icon
    (first build; the A/B against no labels comes later).
  - The middle of the orbit stays empty.
  - Reduced motion: one still arrangement, halos frozen.

  Icon sprites are baked once per mount at BAKE_U and
  scaled per frame, so a frame costs one drawImage per
  icon plus its halo stamps.
*/
const ORBIT_PERIOD_S = 25;
const BAKE_U = 9;
const CUP_PHASE = 0.9;
const HALO_COUNT = 340;
const HALO_CHARS = "·:;+*x%#";
const HALO_SQUASH = 0.8;

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

function bakeCup() {
  const frame = renderFrame(CUP_PHASE);
  const { vals, hits } = frame;
  const u = BAKE_U;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(CUP_COLS * CELL_ASPECT * u);
  cv.height = Math.ceil(CUP_ROWS * u);
  const ctx = cv.getContext("2d");
  ctx.font = `${u}px "Courier New", Courier, monospace`;
  ctx.textBaseline = "top";
  let last = null;
  for (let y = 0; y < CUP_ROWS; y++) {
    for (let x = 0; x < CUP_COLS; x++) {
      const i = y * CUP_COLS + x;
      if (hits[i] <= 0.25) continue;
      const v = Math.max(0, Math.min(1, vals[i] / Math.max(hits[i], 1e-6)));
      const ci = Math.min(RAMP.length - 1, Math.floor(v * (RAMP.length - 1)));
      const ch = RAMP[ci];
      if (ch === " ") continue;
      const f = 0.25 + 0.75 * v;
      // the same Dunkin warmth CupCanvas applies live
      const yNorm = y / (CUP_ROWS - 1);
      const warmth = Math.min(
        0.55,
        0.12 +
          0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, v))) +
          0.2 * Math.max(0, (yNorm - 0.45) / 0.55),
      );
      const cr = IVORY[0] * (1 - warmth) + 1.0 * warmth;
      const cg = IVORY[1] * (1 - warmth) + 0.55 * warmth;
      const cb = IVORY[2] * (1 - warmth) + 0.22 * warmth;
      const color = `rgb(${Math.round(cr * f * 255)},${Math.round(cg * f * 255)},${Math.round(cb * f * 255)})`;
      if (color !== last) {
        ctx.fillStyle = color;
        last = color;
      }
      ctx.fillText(ch, x * CELL_ASPECT * u, y * u);
    }
  }
  return { cv, cols: CUP_COLS, rows: CUP_ROWS, hits };
}

function bakeGrid(grid) {
  const u = BAKE_U;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(grid.cols * CELL_ASPECT * u);
  cv.height = Math.ceil(grid.rows * u);
  const ctx = cv.getContext("2d");
  ctx.font = `${u}px "Courier New", Courier, monospace`;
  ctx.textBaseline = "top";
  let last = null;
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const ci = grid.cells[y][x];
      if (ci < 0) continue;
      const color = grid.palette[ci];
      if (color !== last) {
        ctx.fillStyle = color;
        last = color;
      }
      ctx.fillText(grid.lines[y][x], x * CELL_ASPECT * u, y * u);
    }
  }
  const hits = new Float32Array(grid.cols * grid.rows);
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++)
      hits[y * grid.cols + x] = grid.cells[y][x] >= 0 ? 1 : 0;
  return { cv, cols: grid.cols, rows: grid.rows, hits };
}

function buildHalo(entry) {
  const rng = mulberry32(entry.seed);
  const out = [];
  for (let i = 0; i < HALO_COUNT; i++) {
    out.push({
      rr: 0.8 + 0.5 * Math.pow(rng(), 1.35),
      a0: rng() * Math.PI * 2,
      speed: 0.3 + 0.35 * rng(),
      ch: HALO_CHARS[(rng() * HALO_CHARS.length) | 0],
      big: rng() < 0.4,
    });
  }
  return out;
}

export default function OrbitRing() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let visible = true;

    const icons = ICON_REGISTRY.map((entry) => {
      const baked = entry.kind === "cup" ? bakeCup() : bakeGrid(entry.grid);
      return {
        entry,
        ...baked,
        aspect: baked.cv.width / baked.cv.height,
        halo: buildHalo(entry),
      };
    });

    const drawIcon = (icon, cx, cy, dispW, dispH, depth, t, dpr, fitScale) => {
      const { entry, hits, cols, rows } = icon;
      const sphereR = 0.78 * 0.5 * Math.hypot(dispW, dispH);
      const cellW = dispW / cols;
      const cellH = dispH / rows;
      const x0 = cx - dispW / 2;
      const y0 = cy - dispH / 2;
      const drawHaloHalf = (back) => {
        ctx.globalAlpha = (0.4 + 0.6 * depth) * (back ? 0.85 : 1);
        for (const p of icon.halo) {
          const a = p.a0 + p.speed * t;
          const sa = Math.sin(a);
          if ((sa < 0) !== back) continue;
          const x = cx + Math.cos(a) * p.rr * sphereR;
          const y = cy + sa * p.rr * sphereR * HALO_SQUASH;
          // occlusion against the icon's own hit grid
          const gx = Math.floor((x - x0) / cellW);
          const gy = Math.floor((y - y0) / cellH);
          if (gx >= -1 && gx <= cols && gy >= -1 && gy <= rows) {
            let near = false;
            let inside = false;
            for (let yy = gy - 1; yy <= gy + 1; yy++) {
              if (yy < 0 || yy >= rows) continue;
              for (let xx = gx - 1; xx <= gx + 1; xx++) {
                if (xx < 0 || xx >= cols) continue;
                if (hits[yy * cols + xx] > 0.25) {
                  if (xx === gx && yy === gy) inside = true;
                  else near = true;
                }
              }
            }
            if (back && inside) continue;
            if (near && back) continue;
          }
          const ca = Math.cos(a);
          const shadeF = ca > 0.3 ? 1.05 : ca < -0.3 ? 0.5 : 0.78;
          const u = (p.big ? 9.5 : 6.5) * Math.max(0.45, fitScale);
          const sp = glyphSprite(p.ch, shade(entry.haloTint, shadeF), u, p.big);
          ctx.drawImage(
            sp,
            x - sp.width / (2 * sp._ss),
            y - sp.height / (2 * sp._ss),
            sp.width / sp._ss,
            sp.height / sp._ss,
          );
        }
        ctx.globalAlpha = 1;
      };
      drawHaloHalf(true);
      ctx.globalAlpha = 0.55 + 0.45 * depth;
      ctx.drawImage(icon.cv, x0, y0, dispW, dispH);
      ctx.globalAlpha = 1;
      drawHaloHalf(false);
      // label
      ctx.font = `600 ${Math.max(11, dispH * 0.052)}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      try {
        ctx.letterSpacing = "0.16em";
      } catch { /* plain spacing elsewhere */ }
      ctx.fillStyle = shade("#f2ede1", 0.45 + 0.6 * depth);
      ctx.globalAlpha = 0.5 + 0.5 * depth;
      ctx.fillText(entry.label.toUpperCase(), cx, cy + dispH / 2 + 13);
      ctx.globalAlpha = 1;
      try {
        ctx.letterSpacing = "0px";
      } catch { /* steady */ }
    };

    const draw = (t) => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2 - 22;
      const fit = Math.min(1, W / 900, H / 500);
      // the orbit also has to leave room for the front icon
      // and its halo, so small screens pull the ellipse in
      // rather than letting an icon slide off the edge
      const RX = Math.max(60, Math.min(W * 0.335, 400, W / 2 - 160 * fit - 6));
      const RY = RX * 0.27;
      const placed = icons.map((icon, i) => {
        const th = (i * Math.PI * 2) / icons.length - (t * Math.PI * 2) / ORBIT_PERIOD_S;
        const depth = (Math.sin(th) + 1) / 2;
        const scaleF = (0.58 + 0.52 * depth) * fit;
        // fit the icon into a stage-relative box, aspect kept
        const boxW = 290 * scaleF;
        const boxH = 262 * scaleF;
        let dispW = boxW;
        let dispH = dispW / icon.aspect;
        if (dispH > boxH) {
          dispH = boxH;
          dispW = dispH * icon.aspect;
        }
        return {
          icon,
          fit,
          depth,
          x: cx + RX * Math.cos(th),
          y: cy + RY * Math.sin(th),
          dispW,
          dispH,
        };
      });
      placed.sort((a, b) => a.depth - b.depth);
      for (const p of placed) {
        drawIcon(p.icon, p.x, p.y, p.dispW, p.dispH, p.depth, t, dpr, p.fit);
      }
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "120px" },
    );
    io.observe(stage);
    if (reduced) {
      draw(0); // a still arrangement, icons at the sides
    } else {
      const t0 = performance.now();
      let tick = 0;
      const loop = () => {
        tick += 1;
        if (visible && tick % 2 === 0) draw((performance.now() - t0) / 1000);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => {
      if (reduced) draw(0);
    });
    ro.observe(stage);
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="orbit-fill" aria-hidden="true" />;
}
