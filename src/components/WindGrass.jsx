import { useEffect, useRef } from "react";
import desktopGrid from "../assets/grass-grid-desktop.json";
import mobileGrid from "../assets/grass-grid-mobile.json";
import { shade } from "../lib/discParticles.js";
import { bucket } from "../lib/glyphAtlas.js";

/*
  WindGrass: the About page grass field with weather (Nick's
  plan, approved Oct 25, 2026. The streaks became full wind
  ribbons the same day, rebuilt from reference images he
  shared of the classic wind icon).

  ONE canvas, one offscreen base rendered with the same
  sprite stamps the wind uses. Each wind frame blits the
  base back before painting weather, so a gust repaints
  inside the same material as the field around it. The
  stacked-canvas version showed its erase rectangle as a
  tinted pane and Nick caught it, which is why the single
  canvas exists.

  Weather: gusts are events, every 6-10 seconds, crossing in
  about 3.2 seconds along an arced path. Blades in the gust
  lean along the path direction, flutter at the peak, and
  brighten. Two ribbons ride each gust, flowing glyph lines
  shaped like the classic wind icon. Each ribbon traces
  itself across with a wave running along its length,
  finishes in a spiral curl tipped in gold, and sheds small
  particles at its head that drift back, twinkle, and fade,
  in the spirit of a shooting star trail turned down low.
  Between gusts, a sparse shimmer keeps the field from
  looking dead.

  Perf discipline (the first wind builds taught this the
  hard way, first by saturating the main thread so the page
  stayed black, then by a crash the local harness could not
  see because its software canvas tolerated a bad call):
  - At spawn, a gust precomputes its swept band of cells,
    sorted by x. Frames iterate only a sliding window of it.
  - Only cells the gust actually moves get re-stamped, each
    wiped with a per-cell background fill first. No big
    erase rectangle, no stamps for blades that stay put.
  - Gust frames run at about 12fps, and after an expensive
    frame the next one waits, so the thread always gets
    breathing room. Three very slow frames disable the wind
    for the session and the shimmer remains, rather than
    fight the machine. Cells under the About panel get no
    stamps at all.
  Reduced motion: static field only.
*/
const CELL_ASPECT = 0.6;
const RIBBON_IVORY = "#f2ede1";
const RIBBON_GOLD = "#e8c95d";
const RIBBON_SCALE = 2.4;
const SPARKLE_CHARS = ["+", "*", "·", "'", "."];

// Glyph for a stretch of line travelling at angle ang (screen
// coords, y down). Direction folds modulo PI because a line
// reads the same travelling either way along itself.
const tangentChar = (ang) => {
  const a = ((ang % Math.PI) + Math.PI) % Math.PI;
  const sector = Math.round(a / (Math.PI / 4)) % 4;
  return ["-", "\\", "|", "/"][sector];
};

// One wind ribbon: a gently waving run of glyphs ending in a
// spiral curl, sampled by arc length with the glyph at each
// point chosen from the path direction there. Trail particles
// are attached by the gust spawn, which knows the stage
// geometry they drift through.
const buildRibbon = (len, R, phase, spacing) => {
  const Lm = len * 0.74;
  const amp = 4 + Math.random() * 4;
  const arc = -(5 + Math.random() * 11);
  const turns = 1.15 + Math.random() * 0.2;
  const mainPt = (s) => [
    s * Lm,
    Math.sin(s * 4.4 + phase) * amp + Math.sin(s * Math.PI) * arc,
  ];
  // The spiral enters at the bottom of its circle and sweeps
  // upward, so the loop rolls over the top of the line the
  // way the classic wind icon curls, instead of hanging
  // below it.
  const end = mainPt(1);
  const cx = end[0];
  const cy = end[1] - R;
  const a0 = Math.PI / 2;
  const curlPt = (k) => {
    const ang = a0 - k * turns * 2 * Math.PI;
    const r = R * (1 - k) + 12 * k;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  // raw points carry a curl parameter: 0 along the main run,
  // rising to 1 at the spiral tip, so the draw can taper the
  // glyph scale into the curl and keep the spiral open
  const raw = [];
  const STEPS = 420;
  for (let i = 0; i <= STEPS; i++) {
    const p = mainPt((i / STEPS) * 0.999);
    raw.push([p[0], p[1], 0]);
  }
  for (let i = 1; i <= STEPS; i++) {
    const p = curlPt(i / STEPS);
    raw.push([p[0], p[1], i / STEPS]);
  }
  const sampled = [raw[0]];
  let prev = raw[0];
  let acc = 0;
  for (let i = 1; i < raw.length; i++) {
    const p = raw[i];
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
    if (acc >= spacing) {
      acc = 0;
      sampled.push(p);
    }
  }
  const n = sampled.length;
  const points = sampled.map((p, i) => {
    const q = sampled[Math.min(i + 1, n - 1)];
    const o = sampled[Math.max(i - 1, 0)];
    const ang = Math.atan2(q[1] - o[1], q[0] - o[0]);
    const frac = i / Math.max(1, n - 1);
    let ch = tangentChar(ang);
    if (frac > 0.94 && i % 2 === 0) ch = "o";
    // path normal, used at draw time to lay the side passes
    // that give the line its body
    return { x: p[0], y: p[1], ch, frac, curlK: p[2], nx: -Math.sin(ang), ny: Math.cos(ang) };
  });
  return { points, len, phase };
};

export default function WindGrass({ opacity = 0.6 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let cells = [];
    let panelRect = null;
    let grid = null;
    let u = 0;
    let W = 0;
    let H = 0;
    let visible = true;
    let baseImg = null;
    let windDisabled = false;
    let slowFrames = 0;

    // --- sprite stamps, top-left anchored to match cell origins ---
    const spriteCache = new Map();
    const sprite = (ch, colorCss, scale = 1) => {
      const key = `${ch}|${colorCss}|${scale}`;
      let sp = spriteCache.get(key);
      if (sp) return sp;
      if (spriteCache.size > 9000) spriteCache.clear();
      const ss = 2;
      const wCss = CELL_ASPECT * u * scale + 4;
      const hCss = u * scale + 4;
      const c = document.createElement("canvas");
      c.width = Math.ceil(wCss * ss);
      c.height = Math.ceil(hCss * ss);
      const g = c.getContext("2d");
      g.scale(ss, ss);
      g.font = `${u * scale}px "Courier New", Courier, monospace`;
      g.textBaseline = "top";
      g.fillStyle = colorCss;
      g.fillText(ch, 2, 2);
      sp = { c, w: wCss, h: hCss };
      spriteCache.set(key, sp);
      return sp;
    };
    const stamp = (c2d, sp, gx, gy, flip) => {
      if (flip) {
        c2d.drawImage(sp.c, gx - 2, gy - 2 + sp.h, sp.w, -sp.h);
      } else {
        c2d.drawImage(sp.c, gx - 2, gy - 2, sp.w, sp.h);
      }
    };

    const buildBase = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      if (!W || !H) return;
      grid = W < 720 ? mobileGrid : desktopGrid;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      u = W / (grid.cols * CELL_ASPECT);
      spriteCache.clear();

      cells = [];
      const tileH = grid.rows * u;
      const cellW = CELL_ASPECT * u;
      for (let ty = 0, idx = 0; ty < H; ty += tileH, idx++) {
        const flip = idx % 2 === 1;
        for (let y = 0; y < grid.rows; y++) {
          for (let x = 0; x < grid.cols; x++) {
            const ci = grid.cells[y][x];
            if (ci < 0) continue;
            cells.push({
              x: x * cellW,
              y: flip ? ty + tileH - y * u - u : ty + y * u,
              ch: grid.lines[y][x],
              col: grid.palette[ci],
              flip,
              hash: (((x * 73856093) ^ (y * 19349663) ^ (idx * 83492791)) >>> 0) % 1000 / 1000,
            });
          }
        }
      }
      cells.sort((a, b) => a.x - b.x);

      baseImg = document.createElement("canvas");
      baseImg.width = canvas.width;
      baseImg.height = canvas.height;
      const bg = baseImg.getContext("2d");
      bg.scale(dpr, dpr);
      bg.fillStyle = "#0a0a09";
      bg.fillRect(0, 0, W, H);
      for (const cell of cells) {
        stamp(bg, sprite(cell.ch, cell.col), cell.x, cell.y, cell.flip);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);

      const panel = stage.querySelector(".about-panel");
      if (panel) {
        const sr = stage.getBoundingClientRect();
        const pr = panel.getBoundingClientRect();
        panelRect = {
          x0: pr.left - sr.left - 12,
          y0: pr.top - sr.top - 12,
          x1: pr.right - sr.left + 12,
          y1: pr.bottom - sr.top + 12,
        };
      } else {
        panelRect = null;
      }
    };

    const inPanel = (x, y) =>
      panelRect && x > panelRect.x0 && x < panelRect.x1 && y > panelRect.y0 && y < panelRect.y1;

    // --- weather state ---
    let gust = null;
    let nextGustAt = performance.now() / 1000 + 1.4;
    const pathY = (g, x) => {
      const p = (x + 0.25 * W) / (1.5 * W);
      return g.yBase + g.arc * Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
    };
    const spawnGust = (now) => {
      const dirDown = Math.random() < 0.5 ? 1 : -1;
      const g = {
        t0: now,
        dur: 3.2,
        yBase: H * (0.25 + Math.random() * 0.5),
        arc: dirDown * H * (0.08 + Math.random() * 0.1),
        sigmaX: W * 0.16,
        sigmaY: H * 0.12,
        ribbons: Array.from({ length: 2 }, (_, i) => {
          const r = buildRibbon(
            W * (0.36 + Math.random() * 0.15),
            34 + Math.random() * 13,
            Math.random() * 6.28,
            CELL_ASPECT * u * 2.6,
          );
          r.yOff = (i - 0.5) * H * 0.17 + (Math.random() - 0.5) * H * 0.04;
          r.headLag = i * 150 + Math.random() * 60 - 10;
          return r;
        }),
        band: null,
      };
      // the swept band: cells near the arc, already x-sorted
      g.band = cells.filter((cell) => {
        const cy = cell.y + u * 0.5;
        return Math.abs(cy - pathY(g, cell.x)) < 2.4 * g.sigmaY;
      });
      // Trail particles ride each ribbon. Each one is born
      // near the ribbon head, drifts backward against the
      // gust, twinkles, and fades over about a second and a
      // half, then respawns at the head. Positions live in
      // stage space so the trail stays behind as the gust
      // moves on, the way a shooting star trail hangs in the
      // sky behind the head that shed it.
      for (const r of g.ribbons) {
        const ox0 = -0.25 * W - r.len * 0.8 + r.headLag;
        const oy0 = g.yBase + r.yOff;
        r.particles = Array.from({ length: 48 }, () => {
          const pt = r.points[Math.floor(r.points.length * (0.5 + Math.random() * 0.45))];
          return {
            x0: ox0 + pt.x + (Math.random() - 0.5) * 30,
            y0: oy0 + pt.y + (Math.random() - 0.5) * 90,
            t0: now - Math.random() * 1.2,
            life: 1.3 + Math.random() * 0.8,
            vx: -(30 + Math.random() * 55),
            vy: 3 + Math.random() * 10,
            phase: Math.random() * 6.28,
            speed: 2 + Math.random() * 2.5,
            ch: SPARKLE_CHARS[(Math.random() * SPARKLE_CHARS.length) | 0],
          };
        });
      }
      gust = g;
    };

    const drawWind = (now) => {
      if (!baseImg) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!windDisabled && !gust && now >= nextGustAt) spawnGust(now);

      // ambient shimmer: a few hundred blades breathing light
      for (let i = 0; i < 240; i++) {
        const cell = cells[(Math.random() * cells.length) | 0];
        if (!cell || inPanel(cell.x, cell.y)) continue;
        const b = 1 + 0.14 * Math.sin(now * 0.9 + cell.hash * 6.28);
        if (b <= 1.03) continue;
        stamp(ctx, sprite(cell.ch, shade(cell.col, bucket(b, 0.06))), cell.x, cell.y, cell.flip);
      }

      if (!gust) return;
      const t = (now - gust.t0) / gust.dur;
      if (t >= 1) {
        gust = null;
        nextGustAt = now + 6 + Math.random() * 4;
        return;
      }
      const gx = -0.25 * W + 1.5 * W * t;
      const gy = gust.yBase + gust.arc * Math.sin(Math.PI * t);
      const vx = (1.5 * W) / gust.dur;
      const vy = (gust.arc * Math.PI * Math.cos(Math.PI * t)) / gust.dur;
      const theta = Math.atan2(vy, vx);
      const dirX = Math.cos(theta);
      const dirY = Math.sin(theta);
      const cellW = CELL_ASPECT * u;
      const xLo = gx - 2.2 * gust.sigmaX;
      const xHi = gx + 2.2 * gust.sigmaX;
      const band = gust.band;
      // sliding window over the x-sorted band
      let lo = 0;
      let hi = band.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (band[mid].x < xLo) lo = mid + 1;
        else hi = mid;
      }
      const start = lo;
      hi = band.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (band[mid].x <= xHi) lo = mid + 1;
        else hi = mid;
      }
      const end = lo;
      // pass 1: wipe only the cells the gust truly moves
      const moved = [];
      for (let i = start; i < end; i++) {
        const cell = band[i];
        const cx = cell.x + cellW * 0.5;
        const cy = cell.y + u * 0.5;
        if (inPanel(cx, cy)) continue;
        const dxn = (cx - gx) / gust.sigmaX;
        const dyn = (cy - gy) / gust.sigmaY;
        const g = Math.exp(-(dxn * dxn + dyn * dyn));
        if (g <= 0.05) continue;
        moved.push([cell, g]);
      }
      ctx.fillStyle = "#0a0a09";
      for (const [cell] of moved) {
        ctx.fillRect(cell.x - 0.5, cell.y - 0.5, cellW + 1, u + 1);
      }
      // pass 2: stamp them leaned, fluttered, brightened
      for (const [cell, g] of moved) {
        const flutter = Math.sin(now * 11 + cell.hash * 6.28) * 1.6 * g * g;
        const lean = 8 * g + flutter;
        const b = bucket(1 + 0.4 * g, 0.06);
        stamp(
          ctx,
          sprite(cell.ch, shade(cell.col, b)),
          cell.x + dirX * lean,
          cell.y + dirY * lean,
          cell.flip,
        );
      }
      // Ribbons ride the gust with their heads near its front.
      // The reveal front grows with gust progress, so each
      // line traces itself across and completes its curl,
      // then the whole shape fades on the gust envelope.
      // Body comes from three passes along the path: two side
      // passes offset along the path normal at reduced light,
      // then the bright center pass on top. Glyphs render at
      // RIBBON_SCALE so the chain reads as a stroked line with
      // soft edges rather than a dotted thread. Every pass
      // stamps at partial alpha, so the line stays translucent
      // and reads as light moving through grass rather than
      // paint laid over it. A wave travels along the length
      // while the gust lives, growing toward the tip, so the
      // shape keeps breathing instead of riding across rigid.
      const life = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      const reveal = Math.min(1, t * 2.6);
      const PASSES = [
        { off: -1, f: 0.7, a: 0.4 },
        { off: 1, f: 0.7, a: 0.4 },
        { off: 0, f: 1, a: 0.88 },
      ];
      for (const r of gust.ribbons) {
        const ox = gx - r.len * 0.8 + r.headLag;
        const oy = gy + r.yOff;
        for (const pass of PASSES) {
          ctx.globalAlpha = pass.a;
          for (const p of r.points) {
            if (p.frac > reveal) break;
            // glyph scale tapers into the curl so the spiral
            // stays an open ring instead of filling into a knot
            const ds = Math.round(RIBBON_SCALE * (1 - 0.4 * p.curlK) * 4) / 4;
            const wob = Math.sin(p.frac * 6.5 - now * 5.2 + r.phase) * (1.5 + p.frac * 5.5);
            const sx = ox + p.x + p.nx * pass.off * u * ds * 0.42 - (ds - 1) * cellW * 0.5;
            const sy = oy + p.y + wob + p.ny * pass.off * u * ds * 0.42 - (ds - 1) * u * 0.5;
            if (sx < -30 || sx > W + 30 || inPanel(sx, sy)) continue;
            let f = life * (1 - p.frac * 0.45) * pass.f * 0.92;
            if (pass.off === 0 && reveal - p.frac < 0.06) f *= 1.25;
            if (f < 0.06) continue;
            const col = p.frac > 0.86 ? RIBBON_GOLD : RIBBON_IVORY;
            stamp(ctx, sprite(p.ch, shade(col, bucket(f, 0.05)), ds), sx, sy, false);
          }
        }
        ctx.globalAlpha = 1;
        // Trail particles: born at the head, left behind in
        // stage space, shrinking and dimming as they age.
        for (const pt of r.particles) {
          let age = now - pt.t0;
          if (age > pt.life) {
            const headIdx = Math.floor(
              r.points.length * Math.min(1, reveal) * (0.6 + Math.random() * 0.38),
            );
            const head = r.points[Math.min(r.points.length - 1, headIdx)];
            pt.x0 = ox + head.x + (Math.random() - 0.5) * 36;
            pt.y0 = oy + head.y + (Math.random() - 0.5) * 70;
            pt.t0 = now;
            pt.life = 1.3 + Math.random() * 0.8;
            age = 0;
          }
          const aFrac = age / pt.life;
          const sx = pt.x0 + pt.vx * age;
          const sy = pt.y0 + pt.vy * age + Math.sin(now * 2 + pt.phase) * 3;
          if (sx < -30 || sx > W + 30 || inPanel(sx, sy)) continue;
          const env = Math.sin(Math.PI * Math.min(1, aFrac));
          const tw = 0.6 + 0.4 * Math.sin(now * pt.speed + pt.phase);
          const f = life * env * tw * 1.15;
          if (f < 0.06) continue;
          const sc = aFrac < 0.33 ? 2.6 : aFrac < 0.66 ? 2.0 : 1.5;
          stamp(ctx, sprite(pt.ch, shade(RIBBON_IVORY, bucket(f, 0.05)), sc), sx, sy, false);
        }
      }
    };

    buildBase();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastStart = 0;
    let lastCost = 0;
    if (!reduced) {
      const loop = () => {
        const now = performance.now() / 1000;
        // Gust frames: about 12fps, and always leave the thread
        // a gap after an expensive frame. Ambient frames: 20fps.
        const interval = gust ? Math.max(0.083, lastCost + 0.03) : 0.05;
        if (visible && now - lastStart >= interval) {
          lastStart = now;
          const t0 = performance.now();
          drawWind(now);
          lastCost = (performance.now() - t0) / 1000;
          if (lastCost > 0.12) {
            slowFrames += 1;
            if (slowFrames >= 3) {
              windDisabled = true;
              gust = null;
            }
          } else if (slowFrames > 0) {
            slowFrames -= 1;
          }
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
      className="ascii-field"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
