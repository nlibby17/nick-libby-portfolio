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
  cup. half="back" lives in the sun backdrop and draws the far
  arc; half="front" lives in a fixed overlay above the page
  and draws the near arc in front of the cup. Both read the
  shared spin clock and the same seeded particle set, so the
  two halves are one disc. Particle behavior per the approved
  prototype: Kepler speeds, tangential stretch, a brightness
  boost on the side swinging toward the viewer, soft fades at
  the band edges.
*/
const CELL_ASPECT = 0.6;
const particles = buildParticles(sunGrid);

export default function DiscCanvas({ half }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let raf = 0;
    const t0 = performance.now();

    const draw = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return;
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
      const stage = document.querySelector(".cup-stage");
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      if (rect.bottom < -320 || rect.top > h + 320 || rect.width < 10) return;
      const comX = rect.left + rect.width / 2;
      const comY = rect.top + rect.height / 2;
      const sphereR = rect.width * 0.58;
      const t = spinState.time || (performance.now() - t0) / 1000;
      const u = Math.max(w / (sunGrid.cols * CELL_ASPECT), h / sunGrid.rows);
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

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
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
    ro.observe(parent);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [half]);

  return <canvas ref={ref} className="disc-canvas" aria-hidden="true" />;
}
