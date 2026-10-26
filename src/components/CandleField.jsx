import { useEffect, useRef } from "react";
import data from "../assets/candle-sky-objects.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  CandleField, object architecture (v3.45, Nick's proposal:
  isolate every object first, then apply parallax to the
  isolated objects, never to guessed cell classes).

  The segmentation was done offline at image resolution
  (segment_objects.py beside the research art) and is baked
  into candle-sky-objects.json: every filled grid cell
  carries an owner id. Census of the current art: 251 candle
  objects, 10 bright bodies (the galaxy core and the big
  warm candles), 4 cloud objects (one continent plus three
  banks), 724 specks, and a static residue of faint field.

  Every object is pre-rendered once onto its own small
  canvas. Per frame an object is exactly one drawImage at
  its current offset: rigid by construction, because a
  bitmap cannot tear. Motion is bounded sway, differential
  by class (specks widest, clouds slightest), because
  open-ended drift walks objects out of their neighborhoods
  and dissolves the composition (Nick, thirty seconds into
  v3.43). Specks are the exception: structureless dust may
  travel and wrap, as before.

  Layers:
  - Base canvas: static residue, breathing through a CSS
    filter on the element.
  - Mid canvas: the cloud continent, swaying as one body
    through a CSS transform. Smaller clouds are FX objects.
  - FX canvas: transparent. Objects are drawn whole; the
    sixteen largest green and red candles flicker through a
    brightness filter on their drawImage, a real dimming
    with no masks. Nebula waves light cloud-owned cells in
    place. Springs push individual cells with glyph-shaped
    fades at their posts. Nothing paints a rectangle.

  Reduced motion: all three layers still, no filter.
*/
const CELL_ASPECT = 0.6;
const SEED = 133233;
const POINTER_RADIUS = 230;
const SPRING_K = 110;
const SPRING_C = 8.5;
const DRIFT_VX = -3.4;
const DRIFT_VY = 0.55;

const CLASS_MOTION = {
  speck: { amp: 0, tx: 1, ty: 1 }, // specks travel instead
  "candle-green": { amp: 9, tx: 47, ty: 61 },
  "candle-red": { amp: 9, tx: 47, ty: 61 },
  bright: { amp: 6, tx: 59, ty: 73 },
  cloud: { amp: 4, tx: 71, ty: 89 },
};

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

export default function CandleField({ opacity = 0.6 }) {
  const baseRef = useRef(null);
  const midRef = useRef(null);
  const fxRef = useRef(null);

  useEffect(() => {
    const baseCanvas = baseRef.current;
    const midCanvas = midRef.current;
    const fxCanvas = fxRef.current;
    if (!baseCanvas || !midCanvas || !fxCanvas) return;
    const stage = baseCanvas.parentElement.parentElement;
    const bctx = baseCanvas.getContext("2d");
    const mctx = midCanvas.getContext("2d");
    const ctx = fxCanvas.getContext("2d");
    let raf = 0;
    let W = 0;
    let H = 0;
    let u = 0;
    let visible = true;
    let fxObjects = [];
    let speckObjects = [];
    let nebulaCells = [];
    let springCells = [];
    let continentObj = null;
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
      for (const cv of [baseCanvas, midCanvas, fxCanvas]) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
      }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      u = Math.max(W / (data.cols * CELL_ASPECT), H / data.rows);
      const cellW = CELL_ASPECT * u;
      const ox = (W - data.cols * cellW) / 2;
      const oy = (H - data.rows * u) / 2;
      spriteCache.clear();

      const rand = mulberry32(SEED);
      const objs = data.objects.map((o, i) => {
        const motion = CLASS_MOTION[o.cls] || CLASS_MOTION.bright;
        return {
          id: i + 1, cls: o.cls, cells: [],
          amp: motion.amp,
          tx: motion.tx * (0.85 + rand() * 0.3),
          ty: motion.ty * (0.85 + rand() * 0.3),
          px: rand() * 6.28, py: rand() * 6.28,
          mult: 0.7 + rand() * 0.6,
          flicker: null, cv: null, bx: 0, by: 0, bw: 0, bh: 0,
        };
      });
      const byCells = (a, b) =>
        data.objects[b.id - 1].cells - data.objects[a.id - 1].cells;
      for (const o of objs
        .filter((o) => o.cls === "candle-green" || o.cls === "candle-red")
        .sort(byCells)
        .slice(0, 16)) {
        o.flicker = { phase: rand() * 6.28, speed: 0.9 + rand() * 0.5 };
      }
      const clouds = objs.filter((o) => o.cls === "cloud").sort(byCells);
      continentObj = clouds.length ? clouds[0] : null;

      const paletteRGB = data.palette.map(rgbOf);
      fxObjects = [];
      speckObjects = [];
      nebulaCells = [];
      springCells = [];
      for (let gy = 0; gy < data.rows; gy++) {
        for (let gx = 0; gx < data.cols; gx++) {
          const ci = data.cells[gy][gx];
          if (ci < 0) continue;
          const px = ox + gx * cellW;
          const py = oy + gy * u;
          if (px < -cellW || px > W || py < -u || py > H) continue;
          const rgb = paletteRGB[ci];
          const owner = data.owners[gy][gx];
          const cell = {
            x: px, y: py,
            ch: data.lines[gy][gx], col: data.palette[ci],
            owner,
            nebula: rgb.b > rgb.r && rgb.b > rgb.g && lumOf(rgb) < 0.34,
            spring: null,
            axis: (px * 0.8 + py * 0.6) / (Math.hypot(W, H) || 1),
          };
          if (owner === 0) {
            stamp(bctx, sprite(cell.ch, cell.col), px, py);
            if (cell.nebula) nebulaCells.push({ cell, kind: "static", obj: null });
          } else {
            const obj = objs[owner - 1];
            obj.cells.push(cell);
            if (cell.nebula && obj.cls === "cloud") {
              nebulaCells.push({
                cell,
                kind: obj === continentObj ? "continent" : "object",
                obj,
              });
            }
          }
          if (rand() < 0.1) {
            cell.spring = { ox: 0, oy: 0, vx: 0, vy: 0 };
            if (owner === 0) springCells.push(cell);
          }
        }
      }

      // pre-render every FX object and the continent onto
      // their own canvases, in CSS pixel space at dpr scale
      const renderObject = (o, targetCtx) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const c of o.cells) {
          x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
          x1 = Math.max(x1, c.x + cellW); y1 = Math.max(y1, c.y + u);
        }
        o.bx = x0 - 3; o.by = y0 - 3;
        o.bw = x1 - x0 + 6; o.bh = y1 - y0 + 6;
        if (targetCtx) {
          for (const c of o.cells) stamp(targetCtx, sprite(c.ch, c.col), c.x, c.y);
          return;
        }
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(o.bw * dpr));
        cv.height = Math.max(1, Math.round(o.bh * dpr));
        const g2 = cv.getContext("2d");
        g2.scale(dpr, dpr);
        for (const c of o.cells) {
          stamp(g2, sprite(c.ch, c.col), c.x - o.bx, c.y - o.by);
        }
        o.cv = cv;
      };
      for (const o of objs) {
        if (!o.cells.length) continue;
        if (o.cls === "speck") {
          speckObjects.push(o);
          renderObject(o, null);
        } else if (o === continentObj) {
          renderObject(o, mctx);
        } else {
          fxObjects.push(o);
          renderObject(o, null);
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

    const objOffset = (o, now) => ({
      x: o.amp * Math.sin((now / o.tx) * 6.28 + o.px),
      y: o.amp * 0.6 * Math.sin((now / o.ty) * 6.28 + o.py),
    });
    const continentSway = (now) => ({
      x: 4 * Math.sin((now / 83) * 6.28),
      y: 2.5 * Math.sin((now / 97) * 6.28 + 1.3),
    });
    const offsetsNow = (now) => {
      const m = new Map();
      for (const o of fxObjects) m.set(o.id, objOffset(o, now));
      for (const o of speckObjects) m.set(o.id, null); // computed inline
      return m;
    };

    const drawFx = (now, dt) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cellW = CELL_ASPECT * u;

      pointer.strength += ((pointer.active ? 1 : 0) - pointer.strength) *
        Math.min(1, dt * 5);

      const breathe =
        1 +
        0.2 * Math.sin((now / 14) * 6.28) +
        0.05 * Math.sin((now / 5.3) * 6.28 + 1.7);
      baseCanvas.style.filter = `brightness(${breathe.toFixed(3)})`;
      const cs = continentSway(now);
      midCanvas.style.transform =
        `translate(${cs.x.toFixed(2)}px, ${cs.y.toFixed(2)}px) scale(1.03)`;

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

      const offs = offsetsNow(now);

      // objects, drawn whole; flicker is a filter on the draw
      const drawObject = (o, off) => {
        if (!o.cv) return;
        if (o.flicker) {
          const t = now * o.flicker.speed;
          const f =
            1 +
            0.17 *
              (0.6 * Math.sin(t * 8.3 + o.flicker.phase) +
                0.4 * Math.sin(t * 19.7 + o.flicker.phase * 1.7));
          try {
            ctx.filter = `brightness(${f.toFixed(3)})`;
          } catch { /* steady */ }
          ctx.drawImage(o.cv, o.bx + off.x, o.by + off.y, o.bw, o.bh);
          try {
            ctx.filter = "none";
          } catch { /* steady */ }
        } else {
          ctx.drawImage(o.cv, o.bx + off.x, o.by + off.y, o.bw, o.bh);
        }
      };
      for (const o of fxObjects) drawObject(o, offs.get(o.id));

      // specks travel and wrap as whole objects too
      const spanX = W + cellW * 2;
      const spanY = H + u * 2;
      for (const o of speckObjects) {
        const dxT = now * DRIFT_VX * o.mult;
        const dyT = now * DRIFT_VY * o.mult;
        let wx = dxT % spanX;
        if (wx > 0) wx -= spanX;
        let wy = dyT % spanY;
        if (wy < 0) wy += spanY;
        // draw at the wrapped offset, plus a ghost copy when
        // the object straddles an edge so it never splits
        drawObject(o, { x: wx, y: wy });
        if (o.bx + wx < 0) drawObject(o, { x: wx + spanX, y: wy });
        if (o.by + wy + o.bh > H) drawObject(o, { x: wx, y: wy - spanY });
      }

      // nebula waves light cloud cells in place
      if (now >= nextWaveAt) {
        waves.push({ t0: now, dur: 4.5 });
        nextWaveAt = now + 8 + Math.random() * 7;
      }
      waves = waves.filter((w) => now - w.t0 < w.dur);
      for (const w of waves) {
        const p = (now - w.t0) / w.dur;
        const head = -0.15 + 1.3 * p;
        const env = Math.pow(Math.sin(Math.PI * p), 1.5);
        for (const n of nebulaCells) {
          const dd = (n.cell.axis - head) / 0.055;
          const f = 1 + 1.1 * env * Math.exp(-(dd * dd));
          const b = bucket(f, 0.08);
          if (b <= 1) continue;
          let lx = n.cell.x;
          let ly = n.cell.y;
          if (n.kind === "continent") {
            lx += cs.x; ly += cs.y;
          } else if (n.kind === "object") {
            const oo = offs.get(n.obj.id);
            if (oo) { lx += oo.x; ly += oo.y; }
          }
          stamp(ctx, sprite(n.cell.ch, shade(n.cell.col, b)), lx, ly);
        }
      }

      // springs: individual cells over their object's draw
      const springStamp = (cell, baseX, baseY) => {
        const flare = springStep(cell, dt, baseX + cellW * 0.5, baseY + u * 0.5);
        const s = cell.spring;
        const moved = Math.abs(s.ox) > 0.4 || Math.abs(s.oy) > 0.4;
        if (!moved && flare === 1) return;
        stampAlpha(sprite(cell.ch, "#000000"), baseX, baseY,
          Math.min(0.9, Math.hypot(s.ox, s.oy) / 14 + 0.25));
        const b = bucket(flare, 0.06);
        stamp(ctx, sprite(cell.ch, b === 1 ? cell.col : shade(cell.col, b)),
          baseX + s.ox, baseY + s.oy);
      };
      for (const o of fxObjects) {
        const off = offs.get(o.id);
        for (const cell of o.cells) {
          if (cell.spring) springStamp(cell, cell.x + off.x, cell.y + off.y);
        }
      }
      for (const cell of springCells) springStamp(cell, cell.x, cell.y);
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
      <canvas ref={midRef} className="sprinkle-fill" />
      <canvas ref={fxRef} className="sprinkle-fill" />
    </div>
  );
}
