import { useEffect, useRef } from "react";
import sunGrid from "../assets/sun-grid.json";
import {
  buildParticles,
  discPoint,
  shade,
  DISC_RIN,
  DISC_ROUT,
} from "../lib/discParticles.js";
import { spinState } from "../lib/spinState.js";
import { glyphSprite, drawSprite, bucket } from "../lib/glyphAtlas.js";

/*
  DiscCanvas: one half of the particle disc around the hero
  cup. The layers live INSIDE .cup-stage, absolutely centered
  on it, so the disc is ordinary page content: it scrolls with
  the document on the compositor and cannot lag behind the
  cup the way the fixed, rect-tracking overlays did (Nick's
  report, Oct 25, 2026). All positions are local to the layer;
  the only inputs are the shared spin clock and the layer's
  own size. half="back" draws the far arc under the cup,
  half="front" the near arc over it. Behavior per the approved
  prototype: Kepler speeds, tangential stretch, brightness
  boosted on the approach side, soft fades at the band edges,
  glyph sprite stamps instead of fillText.
*/
const CELL_ASPECT = 0.6;
const particles = buildParticles(sunGrid);

export default function DiscCanvas({ half }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const layer = canvas.parentElement;
    let raf = 0;
    let visible = true;
    const t0 = performance.now();

    const draw = () => {
      const w = layer.clientWidth;
      const h = layer.clientHeight;
      if (!w || !h || !visible) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const comX = w / 2;
      const comY = h / 2;
      // The layer is 200% of the stage width by CSS, and the
      // sphere radius is 0.58 stage widths: 0.29 layer widths.
      const sphereR = 0.29 * w;
      const t = spinState.time || (performance.now() - t0) / 1000;
      const u = Math.max(
        window.innerWidth / (sunGrid.cols * CELL_ASPECT),
        window.innerHeight / sunGrid.rows,
      );
      for (const p of particles) {
        const pt = discPoint(p, t, comX, comY, sphereR);
        if (pt.behind !== (half === "back")) continue;
        const fadeR = Math.min(
          1,
          (DISC_ROUT - p.rr) / 0.17,
          (p.rr - DISC_RIN) / 0.11 + 0.25,
        );
        const dopp = 0.78 + 0.4 * Math.cos(pt.a);
        const b = bucket(
          Math.max(0.25, Math.min(1.75, fadeR * dopp * 1.25)),
          0.1,
        );
        const sp = glyphSprite(p.ch, shade(p.col, b), u, p.rr < 1.04);
        const tx = -Math.sin(pt.a);
        const ty = Math.cos(pt.a) * 0.8;
        const ang = Math.atan2(ty, tx);
        const stretch = Math.min(1.8, 1 + 0.55 * pt.om);
        drawSprite(ctx, sp, pt.x, pt.y, ang, stretch, dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "120px" },
    );
    io.observe(layer);

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      visible = true;
      draw();
    } else {
      let tick = 0;
      const loop = () => {
        tick += 1;
        if (tick % 2 === 0) draw(); // 30fps is plenty for orbits
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(() => draw());
    ro.observe(layer);
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [half]);

  return (
    <div className={`disc-layer disc-layer--${half}`} aria-hidden="true">
      <canvas ref={ref} className="disc-fill" />
    </div>
  );
}
