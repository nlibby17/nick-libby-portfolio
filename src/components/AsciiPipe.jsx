import { useEffect, useRef } from "react";
import gridDown from "../assets/pipe-grid-down.json";
import gridDouble from "../assets/pipe-grid-double.json";

/*
  AsciiPipe (v2, Nick's call, Oct 25, 2026): the pipeline
  pipes are real converted art now. A Mario-style orange
  pipe was drawn as an image and run through the site's
  image-to-ASCII converter; the variants are grid surgery
  on that one conversion. "down" is the grid flipped, so
  its only opening faces down (the lead-in at the top of
  the pipeline). "double" is flange, body, mirrored
  flange: an opening at both ends, used for every
  connector after the first and the closing run.
  A diagonal shine sweeps all pipes in sync off one
  shared epoch clock: a 1.3 second pass inside every
  5 second period, brightening cells near a diagonal
  band. Reduced motion renders the plain grid once.
*/
const GRIDS = { down: gridDown, double: gridDouble };
const CHAR_ASPECT = 0.6;
const PERIOD = 5000;
const SWEEP = 1300;
const EPOCH = performance.now();

const hexCache = new Map();
function rgb(hex) {
  if (!hexCache.has(hex)) {
    hexCache.set(hex, [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ]);
  }
  return hexCache.get(hex);
}

export default function AsciiPipe({ variant = "double" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const grid = GRIDS[variant] || gridDouble;
    const ctx = canvas.getContext("2d");
    const font = '15px "Courier New", Courier, monospace';
    ctx.font = font;
    const cellW = ctx.measureText("M").width;
    const cellH = cellW / CHAR_ASPECT;
    const w = Math.ceil(grid.cols * cellW);
    const h = Math.ceil(grid.rows * cellH);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const draw = (band) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = font;
      ctx.textBaseline = "top";
      for (let y = 0; y < grid.rows; y += 1) {
        const line = grid.lines[y];
        const rowCells = grid.cells[y];
        for (let x = 0; x < grid.cols; x += 1) {
          const ci = rowCells[x];
          if (ci < 0) continue;
          let fill = grid.palette[ci];
          if (band >= 0) {
            const s = (x / grid.cols + y / grid.rows) / 2;
            const boost = Math.max(0, 1 - Math.abs(s - band) / 0.14);
            if (boost > 0) {
              const [r, g, b] = rgb(fill);
              const t = boost * 0.8;
              fill = `rgb(${Math.round(r + (255 - r) * t)},${Math.round(
                g + (255 - g) * t
              )},${Math.round(b + (255 - b) * t)})`;
            }
          }
          ctx.fillStyle = fill;
          ctx.fillText(line[x], x * cellW, y * cellH);
        }
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(-1);
      return undefined;
    }

    let raf = 0;
    let lastKey = "";
    const tick = () => {
      const phase = (performance.now() - EPOCH) % PERIOD;
      const band =
        phase < SWEEP ? -0.25 + (phase / SWEEP) * 1.5 : -1;
      const key =
        band < 0 ? "rest" : String(Math.round(band / 0.02));
      if (key !== lastKey) {
        lastKey = key;
        draw(band);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [variant]);

  return <canvas ref={canvasRef} className="ascii-pipe" aria-hidden="true" />;
}
