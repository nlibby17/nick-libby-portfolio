import { useEffect, useRef } from "react";
import sunGrid from "../assets/sun-grid.json";
import WindGrass from "./WindGrass.jsx";

/*
  AsciiField: draws a converter grid (characters + per-cell palette
  colors, produced by tools/ascii-converter/ascii_convert.py --json)
  onto a canvas filling its container. Cell aspect 0.6 matches
  Courier-family advance width, the traditional ASCII art face;
  Nick's directive, Oct 25, 2026.

  The grass field sizes its glyphs from the container width and
  repeats one grid vertically, mirroring alternate repeats. That
  distinction matters on the tall mobile About stage: forcing a
  short grid to "cover" thousands of pixels of height by itself
  inflated each glyph until the grass pattern disappeared. The
  sun branch retains the older cover-and-crop behavior.

  The hero cup has its own renderer, CupCanvas, which draws real
  rotating geometry instead of a fixed grid.
*/
const CELL_ASPECT = 0.6;

export default function AsciiField({ opacity = 0.55, variant = "grass", anchor = "center" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (variant === "grass") return undefined; // WindGrass renders it
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let raf = 0;

    const draw = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return;
      const grid = sunGrid;
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
  }, [variant, anchor]);

  if (variant === "grass") return <WindGrass opacity={opacity} />;
  return (
    <canvas
      ref={ref}
      className="ascii-field"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
