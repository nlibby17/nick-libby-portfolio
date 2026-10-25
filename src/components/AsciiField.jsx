import { useEffect, useRef } from "react";
import desktopGrid from "../assets/grass-grid-desktop.json";
import mobileGrid from "../assets/grass-grid-mobile.json";

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
*/
const CELL_ASPECT = 0.6;

export default function AsciiField({ opacity = 0.55 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let raf = 0;

    const draw = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return;
      const grid = w < 720 ? mobileGrid : desktopGrid;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#0a0a09";
      ctx.fillRect(0, 0, w, h);
      // cover: pick the cell height that covers both dimensions
      const u = Math.max(w / (grid.cols * CELL_ASPECT), h / grid.rows);
      const gridW = grid.cols * CELL_ASPECT * u;
      const gridH = grid.rows * u;
      const ox = (w - gridW) / 2;
      const oy = (h - gridH) / 2;
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

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    draw();
    const ro = new ResizeObserver(schedule);
    ro.observe(parent);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="ascii-field"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
