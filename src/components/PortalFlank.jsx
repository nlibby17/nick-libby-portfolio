import { useEffect, useRef } from "react";
import blueGrid from "../assets/portal-flank-blue-grid.json";
import orangeGrid from "../assets/portal-flank-orange-grid.json";
import { CELL_ASPECT } from "../lib/cupGeometry.js";
import { shade } from "../lib/discParticles.js";
import { glyphSprite } from "../lib/glyphAtlas.js";
import { computePortalLayout } from "../lib/portalGeometry.js";

/*
  PortalFlank: the Portal page's backdrop (Nick's design,
  Oct 26, 2026). A converted portal ring stands on each
  side of the page inside the fixed backdrop layer, so the
  pair stays on screen while the page scrolls. The blue
  ring takes the left side and the orange ring the right.

  The two source images were converted separately, then
  their grids were height matched by row surgery: both
  rings stand exactly 46 rows tall on a shared 50 row
  canvas, so the pair can never drift into two heights.

  Life comes from light and particles, not from moving
  the art. A brightness wave circulates each rim (the
  swirl), sparks ride the rim ellipse, and embers shed
  off the rim, drift outward, and fade. The blue ring
  turns clockwise and the orange counterclockwise, so the
  tops of both travel toward the content column.

  Performance pass (Oct 26, 2026, after Nick hit lag on
  the live page): the first build fed the glyph atlas a
  fresh shade for nearly every stamp, because the wave
  and spark brightness were continuous values, so the
  sprite cache churned thousands of tiny canvases and the
  main thread blocked for over half of a six second
  probe. The fixes, in order of impact:
  - Every stamped shade now comes off a short fixed
    ladder of levels, so the atlas reaches a small steady
    working set and then only ever hits.
  - The wave is evaluated per angle bucket (72 buckets)
    instead of per cell, and crest glyphs glow in the
    portal tint rather than each cell's own color.
  - The whole effect draws at 15 fps. A slow swirl reads
    the same and the per second cost drops fourfold
    against the 60 fps loop it started in.
  - Spark and ember counts trimmed (64 and 16 a side),
    and the canvas device pixel ratio is capped at 1.5,
    plenty for backdrop art.

  The flanks need real margins: below a viewport width
  that leaves under 120 px beside the 72 rem content
  column, nothing is drawn. Reduced motion gets the two
  still rings and their frozen sparks.
*/
const BAKE_U = 9;
const SPARK_CHARS = "·:+*x%";
const WAVE_SPEED = 1.15; // radians per second
const FRAME_MS = 1000 / 15;
const ANGLE_BUCKETS = 72;
const WAVE_LEVELS = 6;
const SPARK_LEVELS = 8;

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
  return cv;
}

function buildPortal(grid, tint, dir, seed) {
  const rng = mulberry32(seed);
  const baked = bakeGrid(grid);
  // ring cells grouped into angle buckets around the
  // center, so the swirl wave prices 72 buckets a frame
  // instead of every cell
  const buckets = Array.from({ length: ANGLE_BUCKETS }, () => []);
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const ci = grid.cells[y][x];
      if (ci < 0) continue;
      const dx = (x + 0.5 - grid.cols / 2) * CELL_ASPECT;
      const dy = y + 0.5 - grid.rows / 2;
      const ang = Math.atan2(dy, dx);
      const bi =
        Math.floor(((ang + Math.PI) / (Math.PI * 2)) * ANGLE_BUCKETS) %
        ANGLE_BUCKETS;
      buckets[bi].push({ x, y, ch: grid.lines[y][x] });
    }
  }
  const bucketAngles = buckets.map(
    (_, i) => -Math.PI + ((i + 0.5) / ANGLE_BUCKETS) * Math.PI * 2,
  );
  const sparks = [];
  for (let i = 0; i < 64; i++) {
    sparks.push({
      a0: rng() * Math.PI * 2,
      rr: 0.93 + 0.14 * rng(),
      sp: 0.25 + 0.3 * rng(),
      ch: SPARK_CHARS[(rng() * SPARK_CHARS.length) | 0],
      big: rng() < 0.35,
    });
  }
  const embers = [];
  for (let i = 0; i < 16; i++) {
    embers.push({
      ang: rng() * Math.PI * 2,
      rad: 0.99 + 0.1 * rng(),
      vr: 0.015 + 0.035 * rng(),
      life: rng() * 3,
      max: 2.2 + 2 * rng(),
      ch: SPARK_CHARS[(rng() * SPARK_CHARS.length) | 0],
      big: rng() < 0.25,
    });
  }
  return {
    grid,
    baked,
    aspect: baked.width / baked.height,
    buckets,
    bucketAngles,
    sparks,
    embers,
    tint,
    dir,
    rng,
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const ladder = (v, levels) => Math.round(v * levels) / levels;

export default function PortalFlank() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    const portals = [
      buildPortal(blueGrid, "#57baff", 1, 4242),
      buildPortal(orangeGrid, "#ffa63d", -1, 9001),
    ];

    const stamp = (ch, color, u, bold, x, y, alpha) => {
      const sp = glyphSprite(ch, color, u, bold);
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        sp,
        x - sp.width / (2 * sp._ss),
        y - sp.height / (2 * sp._ss),
        sp.width / sp._ss,
        sp.height / sp._ss,
      );
      ctx.globalAlpha = 1;
    };

    const drawPortal = (p, cx, cy, ringW, ringH, t, dt, still) => {
      const { grid } = p;
      const x0 = cx - ringW / 2;
      const y0 = cy - ringH / 2;
      const cellW = ringW / grid.cols;
      const cellH = ringH / grid.rows;
      const rx = ringW * 0.485;
      const ry = ringH * 0.462;

      const drawSparks = (back) => {
        for (const s of p.sparks) {
          const a = s.a0 + p.dir * s.sp * t;
          const sa = Math.sin(a);
          if ((sa < 0) !== back) continue;
          const x = cx + Math.cos(a) * rx * s.rr;
          const y = cy + sa * ry * s.rr;
          // brightness off the fixed ladder, so the atlas
          // only ever holds a handful of spark shades
          const f = ladder(0.35 + 0.65 * ((sa + 1) / 2), SPARK_LEVELS);
          stamp(
            s.ch,
            shade(p.tint, f * 1.15),
            cellH * (s.big ? 0.95 : 0.62),
            s.big,
            x,
            y,
            back ? 0.45 : 0.9,
          );
        }
      };

      drawSparks(true);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(p.baked, x0, y0, ringW, ringH);
      ctx.globalAlpha = 1;
      drawSparks(false);

      if (still) return;

      // the swirl: a brightness wave circulating the rim,
      // priced per angle bucket, crest glyphs glowing in
      // the portal tint off the fixed level ladder, with a
      // fainter second crest half a lap behind
      const phase = p.dir * t * WAVE_SPEED;
      for (let bi = 0; bi < ANGLE_BUCKETS; bi++) {
        const cells = p.buckets[bi];
        if (!cells.length) continue;
        const c1 = Math.cos(p.bucketAngles[bi] - phase);
        const c2 = Math.cos(p.bucketAngles[bi] - phase + Math.PI);
        const raw = Math.max(
          smooth(0.72, 1, c1),
          0.5 * smooth(0.78, 1, c2),
        );
        const inten = ladder(raw, WAVE_LEVELS);
        if (inten < 0.05) continue;
        const color = shade(p.tint, 0.55 + 0.85 * inten);
        for (const cell of cells) {
          stamp(
            cell.ch,
            color,
            cellH * 1.02,
            false,
            x0 + (cell.x + 0.5) * cellW,
            y0 + (cell.y + 0.5) * cellH,
            0.8 * inten,
          );
        }
      }

      // embers shed off the rim and fade as they drift out
      for (const e of p.embers) {
        e.life += dt;
        e.rad += e.vr * dt;
        e.ang += p.dir * 0.05 * dt;
        if (e.life > e.max) {
          e.ang = p.rng() * Math.PI * 2;
          e.rad = 0.99;
          e.vr = 0.015 + 0.035 * p.rng();
          e.life = 0;
          e.max = 2.2 + 2 * p.rng();
        }
        const x = cx + Math.cos(e.ang) * rx * e.rad;
        const y = cy + Math.sin(e.ang) * ry * e.rad;
        stamp(
          e.ch,
          shade(p.tint, 0.85),
          cellH * (e.big ? 0.9 : 0.6),
          e.big,
          x,
          y,
          (1 - e.life / e.max) * 0.7,
        );
      }
    };

    const draw = (t, dt, still) => {
      const W = stage.clientWidth;
      const H = stage.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const layout = computePortalLayout(W, H);
      if (!layout) return; // no honest room for flanks
      const entries = [layout.left, layout.right];
      for (let i = 0; i < portals.length; i++) {
        const e = entries[i];
        drawPortal(portals[i], e.cx, e.cy, e.ringW, e.ringH, t, dt, still);
      }
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      draw(0, 0, true);
    } else {
      let lastDraw = performance.now();
      const loop = (now) => {
        if (now - lastDraw >= FRAME_MS) {
          const dt = Math.min(0.12, (now - lastDraw) / 1000);
          lastDraw = now;
          draw(now / 1000, dt, false);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const onResize = () => {
      if (reduced) draw(0, 0, true);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="portal-flank-fill" aria-hidden="true" />;
}
