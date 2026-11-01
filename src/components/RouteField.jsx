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
  silver streets, capped below the route's brightness so
  the route can outshine its own map.

  The route: a bright ribbon of filled cells traces the
  shoreline drive from the north end of the map to the
  Museum Campus, stopping at five of the analysis's real
  top casual start stations (Oak Street, Navy Pier,
  Monroe Street, Millennium Park, Shedd Aquarium). Each
  station flashes a gold diamond as the route reaches it
  and stays lit. Placement follows the map's geography
  by eye; it is faithful, not survey grade. The loop
  draws, holds, fades, and redraws. Reduced motion gets
  the finished route, still.

  Rendering follows the TopoField discipline: one canvas,
  an offscreen base stamped once from glyph sprites, and
  per-frame work limited to the route layer.
*/
const CELL_ASPECT = 0.6;
const BG = "#0a0a09";
const ROUTE_COLOR = "#d7dee5";
const STATION_GLYPH = "◆";
const STATION_COLOR = "#e8c95d"; // --gold-bright
const DRAW_MS = 9000;
const HOLD_MS = 4000;
const FADE_MS = 1600;
const GAP_MS = 1400;
const LOOP_MS = DRAW_MS + HOLD_MS + FADE_MS + GAP_MS;

// Shoreline drive, traced by eye down the map in grid
// fractions (x across, y down), north to south.
const SHORELINE = [
  [0.545, 0.0],
  [0.552, 0.1],
  [0.565, 0.2],
  [0.572, 0.32],
  [0.578, 0.45],
  [0.585, 0.58],
  [0.598, 0.7],
  [0.615, 0.8],
  [0.635, 0.9],
  [0.655, 1.0],
];

// The route's stops, in grid fractions: five of the top
// casual start stations from the analysis.
const STATIONS = [
  [0.552, 0.08], // Michigan Ave & Oak St
  [0.578, 0.155], // Navy Pier
  [0.578, 0.44], // DuSable Lake Shore Dr & Monroe St
  [0.582, 0.56], // Millennium Park
  [0.608, 0.76], // Shedd Aquarium
];

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Two-family remap: blue-dominant palette entries are the
// lake waves and become dim steel; the rest are streets
// and compass line work, held to silver under the route.
function remapColor(hex) {
  const [r, g, b] = hexRgb(hex);
  if (b > r + 30 && b >= g) {
    return `rgb(${Math.round(r * 0.3)},${Math.round(g * 0.48)},${Math.round(b * 0.6)})`;
  }
  const s = 0.78;
  return `rgb(${Math.round(r * s)},${Math.round(g * s)},${Math.round(b * s)})`;
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
    let baseImg = null;
    let routeCells = []; // {x, y} pixel coords, in order
    let stationMarks = []; // {x, y, at} path index reached

    const spriteCache = new Map();
    const sprite = (ch, colorCss, scale = 1) => {
      const key = `${ch}|${colorCss}|${scale}`;
      let sp = spriteCache.get(key);
      if (sp) return sp;
      if (spriteCache.size > 4000) spriteCache.clear();
      const ss = 2;
      const px = u * scale;
      const wCss = CELL_ASPECT * u + 4 + px * 0.4;
      const hCss = u + 4 + px * 0.4;
      const c = document.createElement("canvas");
      c.width = Math.ceil(wCss * ss);
      c.height = Math.ceil(hCss * ss);
      const g = c.getContext("2d");
      g.scale(ss, ss);
      g.font = `${px}px "Courier New", Courier, monospace`;
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
      const ox = (W - gridW) / 2;
      const oy = (H - gridH) / 2;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      spriteCache.clear();

      baseImg = document.createElement("canvas");
      baseImg.width = canvas.width;
      baseImg.height = canvas.height;
      const bg = baseImg.getContext("2d");
      bg.scale(dpr, dpr);
      bg.fillStyle = BG;
      bg.fillRect(0, 0, W, H);
      const cellW = CELL_ASPECT * u;
      for (let gy = 0; gy < grid.rows; gy++) {
        const rowCells = grid.cells[gy];
        const line = grid.lines[gy];
        for (let gx = 0; gx < grid.cols; gx++) {
          const ci = rowCells[gx];
          if (ci < 0) continue;
          const col = grid.palette[ci];
          const [r, g, b] = hexRgb(col);
          if (r * 0.2126 + g * 0.7152 + b * 0.0722 < 12) continue;
          const sp = sprite(line[gx], remapColor(col));
          bg.drawImage(sp.c, ox + gx * cellW - 2, oy + gy * u - 2, sp.w, sp.h);
        }
      }

      // Route path: walk the shoreline polyline in grid
      // space, one cell per step, duplicates removed.
      const toCell = ([fx, fy]) => [
        Math.round(fx * (grid.cols - 1)),
        Math.round(fy * (grid.rows - 1)),
      ];
      const path = [];
      const seen = new Set();
      for (let i = 0; i < SHORELINE.length - 1; i++) {
        const [x0, y0] = toCell(SHORELINE[i]);
        const [x1, y1] = toCell(SHORELINE[i + 1]);
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; s++) {
          const gx = Math.round(x0 + ((x1 - x0) * s) / steps);
          const gy = Math.round(y0 + ((y1 - y0) * s) / steps);
          const key = gy * grid.cols + gx;
          if (seen.has(key)) continue;
          seen.add(key);
          path.push({ x: ox + gx * cellW, y: oy + gy * u, gx, gy });
        }
      }
      routeCells = path;
      stationMarks = STATIONS.map(([fx, fy]) => {
        const [sx, sy] = toCell([fx, fy]);
        let best = 0;
        let bestD = Infinity;
        path.forEach((cell, idx) => {
          const d = (cell.gx - sx) ** 2 + (cell.gy - sy) ** 2;
          if (d < bestD) {
            bestD = d;
            best = idx;
          }
        });
        const cell = path[best];
        return { x: cell.x, y: cell.y, at: best };
      });

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
    };

    const stampRoute = (headIdx, alpha, pulseAt, pulseT) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = alpha;
      // The route is a ribbon of filled cells, one cell
      // wide: a block GLYPH stamped from a padded sprite
      // overlaps its neighbours into a solid bar (caught
      // in QA, Nov 1, 2026), so the ribbon is rects, and
      // only the moving head burns at full white.
      const cellW = CELL_ASPECT * u;
      const n = Math.min(headIdx, routeCells.length - 1);
      ctx.fillStyle = ROUTE_COLOR;
      for (let i = 0; i <= n; i++) {
        const cell = routeCells[i];
        ctx.fillRect(cell.x, cell.y, cellW + 0.6, u + 0.6);
      }
      if (n >= 0 && n < routeCells.length - 1) {
        const head = routeCells[n];
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(
          head.x - cellW * 0.3,
          head.y - u * 0.15,
          cellW * 1.6,
          u * 1.3,
        );
      }
      for (const st of stationMarks) {
        if (st.at > headIdx) continue;
        let scale = 1.35;
        if (pulseAt === st.at && pulseT >= 0) {
          scale = 1.35 + 0.55 * Math.max(0, 1 - pulseT / 0.5);
        }
        const ss = sprite(STATION_GLYPH, STATION_COLOR, scale);
        ctx.drawImage(
          ss.c,
          st.x + (CELL_ASPECT * u) / 2 - ss.w / 2 + 2,
          st.y + u / 2 - ss.h / 2 + 2,
          ss.w,
          ss.h,
        );
      }
      ctx.globalAlpha = 1;
    };

    build();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      if (baseImg) stampRoute(routeCells.length - 1, 1, -1, -1);
    } else {
      const t0 = performance.now();
      let lastHead = -1;
      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        if (!visible || !baseImg) return;
        const t = (now - t0) % LOOP_MS;
        if (t < DRAW_MS) {
          const head = Math.floor(
            (t / DRAW_MS) * (routeCells.length - 1),
          );
          if (head === lastHead) return;
          // pulse bookkeeping: a station pulses for the
          // half second after the head passes it
          let pulseAt = -1;
          let pulseT = -1;
          for (const st of stationMarks) {
            const passedAgo =
              ((st.at / Math.max(1, routeCells.length - 1)) * DRAW_MS);
            if (t >= passedAgo && t < passedAgo + 500) {
              pulseAt = st.at;
              pulseT = (t - passedAgo) / 1000;
            }
          }
          lastHead = head;
          stampRoute(head, 1, pulseAt, pulseT);
        } else if (t < DRAW_MS + HOLD_MS) {
          if (lastHead !== routeCells.length - 1) {
            lastHead = routeCells.length - 1;
            stampRoute(lastHead, 1, -1, -1);
          }
        } else if (t < DRAW_MS + HOLD_MS + FADE_MS) {
          const ft = (t - DRAW_MS - HOLD_MS) / FADE_MS;
          stampRoute(routeCells.length - 1, 1 - ft, -1, -1);
          lastHead = -2;
        } else if (lastHead !== -3) {
          lastHead = -3;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(baseImg, 0, 0);
        }
      };
      raf = requestAnimationFrame(frame);
    }
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "120px" },
    );
    io.observe(layer);
    const ro = new ResizeObserver(() => {
      build();
      if (reduced && baseImg) stampRoute(routeCells.length - 1, 1, -1, -1);
    });
    ro.observe(layer);
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
