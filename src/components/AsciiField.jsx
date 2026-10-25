import { useEffect, useRef } from "react";
import desktopGrid from "../assets/grass-grid-desktop.json";
import mobileGrid from "../assets/grass-grid-mobile.json";
import sunGrid from "../assets/sun-grid.json";
import cupGrid from "../assets/cup-grid.json";

/*
  AsciiField: draws a converter grid (characters + per-cell palette
  colors, produced by tools/ascii-converter/ascii_convert.py --json)
  onto a canvas that COVERS its container. The grid is never
  stretched: the cell size is chosen so the grid covers the box,
  centered, with any overflow cropped at the edges, the same rule
  as background-size: cover for an image. Two grids ship (desktop
  340 cols, mobile 176 cols) so phones get a grid rendered at
  their size instead of a shrunk desktop one. Cell aspect 0.6
  matches Courier-family advance width, the traditional ASCII
  art face; Nick's directive, Oct 25, 2026.

  The cup variant is animated, and the motion matters, per Nick:
  the cup spins around its own long axis, the pole through the
  cup, the way a dancer spins on a pole. Not a pinwheel: the
  silhouette stays put and the surface travels around the axis.
  Implementation: the grid is treated as a texture wrapped on a
  cylinder whose axis is fitted from the grid itself (least
  squares over per-row centroids). Each frame, every screen cell
  is mapped back through the rotation to the texture cell it
  shows, with simple cylindrical shading. The straw sits on the
  axis, so it stays near still while the body turns around it.
*/
const CELL_ASPECT = 0.6;
const SPIN_MS = 14000;

const shadeCache = new Map();
function shade(hex, f) {
  const key = `${hex}|${Math.round(f * 24)}`;
  let out = shadeCache.get(key);
  if (out) return out;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  out = `rgb(${r},${g},${b})`;
  shadeCache.set(key, out);
  return out;
}

export default function AsciiField({ opacity = 0.55, variant = "grass", anchor = "center" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let raf = 0;
    let spinRaf = 0;
    let phase = 0;

    const fitCanvas = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return null;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      return { w, h, ctx };
    };

    const drawStatic = () => {
      const fit = fitCanvas();
      if (!fit) return;
      const { w, h, ctx } = fit;
      const grid =
        variant === "sun" ? sunGrid : w < 720 ? mobileGrid : desktopGrid;
      ctx.fillStyle = "#0a0a09";
      ctx.fillRect(0, 0, w, h);
      const u = Math.max(w / (grid.cols * CELL_ASPECT), h / grid.rows);
      const gridW = grid.cols * CELL_ASPECT * u;
      const gridH = grid.rows * u;
      const ox = (w - gridW) / 2;
      const oy = anchor === "top" ? 0 : (h - gridH) / 2;
      ctx.font = `${u}px "Courier New", Courier, monospace`;
      ctx.textBaseline = "top";
      let lastColor = null;
      for (let y = 0; y < grid.rows; y++) {
        const line = grid.lines[y];
        const rowCells = grid.cells[y];
        const py = oy + y * u;
        if (py < -u || py > h) continue;
        for (let x = 0; x < grid.cols; x++) {
          const ci = rowCells[x];
          if (ci < 0) continue;
          const px = ox + x * CELL_ASPECT * u;
          if (px < -u || px > w) continue;
          const color = grid.palette[ci];
          if (color !== lastColor) {
            ctx.fillStyle = color;
            lastColor = color;
          }
          ctx.fillText(line[x], px, py);
        }
      }
    };

    /* ---- cup: spin around its own long axis ---- */

    // Fit the axis once from the grid's per-row centroids.
    const grid = cupGrid;
    let axis = null;
    {
      const cents = [];
      for (let y = 0; y < grid.rows; y++) {
        let sum = 0;
        let n = 0;
        for (let x = 0; x < grid.cols; x++) {
          if (grid.cells[y][x] >= 0) {
            sum += x * CELL_ASPECT;
            n++;
          }
        }
        if (n) cents.push([y, sum / n]);
      }
      const n = cents.length;
      const my = cents.reduce((a, c) => a + c[0], 0) / n;
      const mx = cents.reduce((a, c) => a + c[1], 0) / n;
      let sxy = 0;
      let syy = 0;
      for (const [y, x] of cents) {
        sxy += (y - my) * (x - mx);
        syy += (y - my) * (y - my);
      }
      const a = sxy / syy; // axis: X = a*Y + b
      const b = mx - a * my;
      const L = Math.hypot(a, 1);
      const dir = { x: a / L, y: 1 / L };
      const perp = { x: -dir.y, y: dir.x };
      const O = { x: b, y: 0 };
      let R = 0;
      for (let y = 0; y < grid.rows; y++) {
        for (let x = 0; x < grid.cols; x++) {
          if (grid.cells[y][x] < 0) continue;
          const rx = x * CELL_ASPECT - O.x;
          const ry = y - O.y;
          const s = Math.abs(rx * perp.x + ry * perp.y);
          if (s > R) R = s;
        }
      }
      axis = { dir, perp, O, R };
    }

    const drawCup = () => {
      const fit = fitCanvas();
      if (!fit) return;
      const { w, h, ctx } = fit;
      const { dir, perp, O, R } = axis;
      const u = Math.max(w / (grid.cols * CELL_ASPECT), h / grid.rows);
      const gridW = grid.cols * CELL_ASPECT * u;
      const gridH = grid.rows * u;
      const ox = (w - gridW) / 2;
      const oy = (h - gridH) / 2;
      ctx.font = `${u}px "Courier New", Courier, monospace`;
      ctx.textBaseline = "top";
      let lastColor = null;
      for (let y = 0; y < grid.rows; y++) {
        const py = oy + y * u;
        if (py < -u || py > h) continue;
        for (let x = 0; x < grid.cols; x++) {
          const rx = x * CELL_ASPECT - O.x;
          const ry = y - O.y;
          const t = rx * dir.x + ry * dir.y;
          const s = rx * perp.x + ry * perp.y;
          if (Math.abs(s) > R) continue;
          const un = s / R;
          const alpha = Math.asin(Math.max(-1, Math.min(1, un)));
          const beta = alpha - phase;
          const sSrc = R * Math.sin(beta);
          const pxSrc = O.x + dir.x * t + perp.x * sSrc;
          const pySrc = O.y + dir.y * t + perp.y * sSrc;
          const sx = Math.round(pxSrc / CELL_ASPECT);
          const sy = Math.round(pySrc);
          if (sx < 0 || sy < 0 || sx >= grid.cols || sy >= grid.rows) continue;
          const ci = grid.cells[sy][sx];
          if (ci < 0) continue;
          let f = 0.45 + 0.55 * Math.cos(alpha);
          if (Math.cos(beta) < 0) f *= 0.8;
          const color = shade(grid.palette[ci], f);
          if (color !== lastColor) {
            ctx.fillStyle = color;
            lastColor = color;
          }
          ctx.fillText(grid.lines[sy][sx], ox + x * CELL_ASPECT * u, py);
        }
      }
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (variant === "cup") {
      if (reduced) {
        drawCup();
      } else {
        const t0 = performance.now();
        const loop = (now) => {
          phase = (((now - t0) / SPIN_MS) * Math.PI * 2) % (Math.PI * 2);
          drawCup();
          spinRaf = requestAnimationFrame(loop);
        };
        spinRaf = requestAnimationFrame(loop);
      }
    } else {
      drawStatic();
    }

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(variant === "cup" ? drawCup : drawStatic);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(parent);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(spinRaf);
    };
  }, [variant, anchor]);

  return (
    <canvas
      ref={ref}
      className="ascii-field"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
