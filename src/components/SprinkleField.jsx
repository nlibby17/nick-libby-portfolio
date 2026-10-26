import { useEffect, useRef } from "react";

/*
  SprinkleField: the Dunkin project page's ASCII backdrop
  (Nick, Oct 25, 2026). Project pages get their own fields
  the way About has its grass. Dunkin's is sprinkles: tiny
  dashes in the donut palette scattered sparse, most of
  them resting with a soft shimmer, a few always drifting
  down the page like they were shaken loose. Seeded, so
  the arrangement is identical on every load.
*/
const CHARS = ["-", "\\", "/", "|", "'", "`"];
const PALETTE = ["#e0651f", "#e0659f", "#8a5a2b", "#f2ede1", "#e8c95d"];
const CELL = 30;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function SprinkleField() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const layer = canvas.parentElement;
    let raf = 0;
    let visible = true;
    let parts = [];
    let W = 0;
    let H = 0;
    let last = performance.now();

    const build = () => {
      W = layer.clientWidth;
      H = window.innerHeight;
      if (!W || !H) return;
      const rng = mulberry32(133233);
      parts = [];
      const cols = Math.ceil(W / CELL);
      const rows = Math.ceil(H / CELL);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (rng() > 0.225) continue;
          parts.push({
            x: (x + rng()) * CELL,
            y: (y + rng()) * CELL,
            ch: CHARS[(rng() * CHARS.length) | 0],
            col: PALETTE[(rng() * PALETTE.length) | 0],
            ph: rng() * Math.PI * 2,
            faller: rng() < 0.16,
            speed: 10.5 + rng() * 13.5,
            sway: rng() * Math.PI * 2,
          });
        }
      }
    };

    const draw = (now) => {
      if (!W || !H) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = `15px "Courier New", Courier, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const p of parts) {
        if (p.faller) {
          p.y += p.speed * dt;
          p.x += Math.sin(now / 1500 + p.sway) * 4 * dt;
          if (p.y > H + 12) {
            p.y = -12;
          }
        }
        const tw = 0.32 + 0.26 * (0.5 + 0.5 * Math.sin(now / 950 + p.ph));
        ctx.globalAlpha = tw;
        ctx.fillStyle = p.col;
        ctx.fillText(p.ch, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "120px" },
    );
    io.observe(layer);

    build();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      draw(performance.now());
    } else {
      let tick = 0;
      const loop = (now) => {
        tick += 1;
        if (tick % 2 === 0 && visible) draw(now);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => {
      build();
      draw(performance.now());
    });
    ro.observe(layer);
    window.addEventListener("resize", build);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", build);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="sprinkle-fill" aria-hidden="true" />;
}
