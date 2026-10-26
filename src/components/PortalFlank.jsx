import { useEffect, useRef } from "react";
import blueGrid from "../assets/portal-flank-blue-grid.json";
import orangeGrid from "../assets/portal-flank-orange-grid.json";
import { CELL_ASPECT } from "../lib/cupGeometry.js";
import { shade } from "../lib/discParticles.js";
import { glyphSprite } from "../lib/glyphAtlas.js";

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
  tops of both travel toward the content column. All of
  it stamps pre-rendered glyph sprites, the same cheap
  machinery as the homepage halos.

  The flanks need real margins: below a viewport width
  that leaves under 120 px beside the 72 rem content
  column, nothing is drawn. Reduced motion gets the two
  still rings and their frozen sparks.
*/
const BAKE_U = 9;
const CONTENT_W = 1152; // the site's --page-width, 72 rem
const SPARK_CHARS = "·:+*x%";
const WAVE_SPEED = 1.15; // radians per second

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
  const cells = [];
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const ci = grid.cells[y][x];
      if (ci < 0) continue;
      const dx = (x + 0.5 - grid.cols / 2) * CELL_ASPECT;
      const dy = y + 0.5 - grid.rows / 2;
      cells.push({
        x,
        y,
        ch: grid.lines[y][x],
        color: grid.palette[ci],
        ang: Math.atan2(dy, dx),
      });
    }
  }
  const sparks = [];
  for (let i = 0; i < 80; i++) {
    sparks.push({
      a0: rng() * Math.PI * 2,
      rr: 0.93 + 0.14 * rng(),
      sp: 0.25 + 0.3 * rng(),
      ch: SPARK_CHARS[(rng() * SPARK_CHARS.length) | 0],
      big: rng() < 0.35,
    });
  }
  const embers = [];
  for (let i = 0; i < 22; i++) {
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
    cells,
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
          const f = 0.35 + 0.65 * ((sa + 1) / 2);
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
      // with a fainter second crest half a lap behind it
      const phase = p.dir * t * WAVE_SPEED;
      for (const cell of p.cells) {
        const c1 = Math.cos(cell.ang - phase);
        const c2 = Math.cos(cell.ang - phase + Math.PI);
        const inten = Math.max(
          smooth(0.72, 1, c1),
          0.5 * smooth(0.78, 1, c2),
        );
        if (inten < 0.03) continue;
        stamp(
          cell.ch,
          shade(cell.color, 1 + 0.9 * inten),
          cellH * 1.02,
          false,
          x0 + (cell.x + 0.5) * cellW,
          y0 + (cell.y + 0.5) * cellH,
          0.8 * inten,
        );
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
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const margin = (W - CONTENT_W) / 2;
      if (margin < 120) return; // no honest room for flanks
      for (let i = 0; i < portals.length; i++) {
        const p = portals[i];
        let ringW = Math.min(margin * 1.15, 330);
        let ringH = ringW / p.aspect;
        if (ringH > H * 0.94) {
          ringH = H * 0.94;
          ringW = ringH * p.aspect;
        }
        const cx = i === 0 ? margin / 2 + 4 : W - margin / 2 - 4;
        drawPortal(p, cx, H / 2, ringW, ringH, t, dt, still);
      }
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      draw(0, 0, true);
    } else {
      let last = performance.now();
      let tick = 0;
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        tick += 1;
        if (tick % 2 === 0) draw(now / 1000, dt * 2, false);
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
