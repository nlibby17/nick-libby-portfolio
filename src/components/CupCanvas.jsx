import { useEffect, useRef } from "react";

/*
  CupCanvas: the hero cup, rendered as real geometry into ASCII.

  The model (Nick's middle path, Oct 25, 2026): three shapes, a
  tapered frustum body, a two-step lid, a centered straw, carrying
  a procedural surface in cylinder space (ice cubes as placed
  faceted objects, a liquid line, condensation, quiet milk swirl),
  so the surface is consistent from every side.

  The motion, in Nick's own translated spec: the cup is a segment
  set at an angle to a vertical line through its center of mass,
  rotated a full 360 around that vertical line. Lean 27 degrees
  (Nick kept the angle from the renders over the 45 in the
  written definition). Transform order: lean at the center of
  mass first, then rotation about the world vertical, then a
  slight camera elevation.

  One ray per character cell (2x2 supersampled) against closed-
  form cone/cylinder/plane intersections. Ported from the offline
  proof renderer in stage2-research/cup3d/cup3d.py, whose still
  frames Nick approved.
*/

const COLS = 97;
const ROWS = 83;
const CELL_ASPECT = 0.6;
const PLANE_W = 3.95;
const PLANE_H = 5.63;
const SPIN_MS = 16000;
const RAMP = " .·:;+*x%#@";
const IVORY = [0.95, 0.925, 0.87];

const BODY_Y0 = -1.55;
const BODY_Y1 = 1.45;
const R_BOT = 0.84;
const R_TOP = 1.0;
const K_TAPER = (R_TOP - R_BOT) / (BODY_Y1 - BODY_Y0);
const LID_RIM_R = 1.07;
const LID_RIM_Y1 = 1.56;
const LID_TOP_R = 1.0;
const LID_TOP_Y1 = 1.63;
const STRAW_R = 0.115;
const STRAW_Y0 = -0.8;
const STRAW_Y1 = 2.62;
const LEAN = (-27 * Math.PI) / 180;
const ELEV = (16 * Math.PI) / 180;

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

const rng = mulberry32(133233);
const CUBES = [];
for (let i = 0; i < 14; i++) {
  CUBES.push({
    tc: rng() * Math.PI * 2,
    yc: -1.25 + rng() * 2.3,
    hw: 0.34 + rng() * 0.16,
    hh: 0.3 + rng() * 0.15,
    seed: rng(),
  });
}

function angdiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function bodyTexture(theta, y) {
  let v = 0;
  v += 0.02 * Math.sin(3 * theta + 2.2 * y);
  v += 0.016 * Math.sin(7 * theta - 3.1 * y + 1.3);
  v += 0.01 * Math.sin(12 * theta + 5.0 * y);
  v -= 0.1 * Math.max(0, Math.min(1, (0.2 - y) / 1.7));
  v += 0.1 * Math.exp(-((y - 1.3) ** 2) / 0.004);
  v -= 0.07 * Math.exp(-((y - 1.16) ** 2) / 0.01);
  for (const c of CUBES) {
    const dth = angdiff(theta, c.tc);
    const rot = (c.seed - 0.5) * 0.9;
    const u = dth * Math.cos(rot) - (y - c.yc) * Math.sin(rot) * 0.6;
    const w = dth * Math.sin(rot) * 0.6 + (y - c.yc) * Math.cos(rot);
    const au = Math.abs(u);
    const aw = Math.abs(w);
    const inside = au < c.hw && aw < c.hh;
    if (inside) {
      v += u * 0.8 + w > 0 ? 0.14 : 0.02; // facet tone
      if (au > c.hw - 0.055 || aw > c.hh - 0.055) v += 0.13; // bright rim
    } else if (au < c.hw + 0.05 && aw < c.hh + 0.05) {
      v -= 0.08;
    }
  }
  const h1 = Math.abs(Math.sin(theta * 127.1 + y * 311.7) * 43758.5453) % 1;
  const dens = 0.045 + 0.05 * Math.max(0, Math.min(1, (0.4 - y) / 1.9));
  if (h1 < dens) v += 0.16;
  return v;
}

function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function rotY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function mul(A, B) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] =
        A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return o;
}
function apply(M, x, y, z) {
  return [
    M[0] * x + M[1] * y + M[2] * z,
    M[3] * x + M[4] * y + M[5] * z,
    M[6] * x + M[7] * y + M[8] * z,
  ];
}
function transpose(M) {
  return [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
}

const Lraw = [-0.5, 0.42, -0.74];
const Llen = Math.hypot(...Lraw);
const L = Lraw.map((v) => v / Llen);
const Hv = (() => {
  const h = [L[0], L[1], L[2] - 1];
  const l = Math.hypot(...h);
  return h.map((v) => v / l);
})();

function shadeValue(M, nx, ny, nz, base) {
  const nl = Math.hypot(nx, ny, nz) || 1;
  const [vx, vy, vz] = apply(M, nx / nl, ny / nl, nz / nl);
  const ndl = Math.max(0, Math.min(1, vx * L[0] + vy * L[1] + vz * L[2]));
  const ndh = Math.max(0, Math.min(1, vx * Hv[0] + vy * Hv[1] + vz * Hv[2]));
  const spec = Math.pow(ndh, 26) * 0.38;
  const ndv = Math.abs(-vz);
  return base * (0.68 + 0.32 * ndl) + spec + (ndv - 1) * 0.05;
}

// Render one frame into a values grid + hit mask.
function renderFrame(phase) {
  const M = mul(rotX(ELEV), mul(rotY(phase), rotZ(LEAN)));
  const Minv = transpose(M);
  const ss = 2;
  const gw = COLS * ss;
  const gh = ROWS * ss;
  const vals = new Float32Array(COLS * ROWS);
  const hits = new Float32Array(COLS * ROWS);

  for (let gy = 0; gy < gh; gy++) {
    const sy = (0.5 - (gy + 0.5) / gh) * PLANE_H;
    for (let gx = 0; gx < gw; gx++) {
      const sx = ((gx + 0.5) / gw - 0.5) * PLANE_W;
      const [ox, oy, oz] = apply(Minv, sx, sy, -8);
      const [dx, dy, dz] = apply(Minv, 0, 0, 1);
      let bestT = Infinity;
      let bestVal = 0;

      const consider = (t, nx, ny, nz, base) => {
        if (t > 0 && t < bestT) {
          bestT = t;
          bestVal = shadeValue(M, nx, ny, nz, base);
        }
      };

      // frustum body
      {
        const r0 = R_BOT - K_TAPER * BODY_Y0;
        const A = dx * dx + dz * dz - (K_TAPER * dy) ** 2;
        const B =
          2 * (ox * dx + oz * dz - K_TAPER * dy * (r0 + K_TAPER * oy));
        const C = ox * ox + oz * oz - (r0 + K_TAPER * oy) ** 2;
        const disc = B * B - 4 * A * C;
        if (disc > 0 && Math.abs(A) > 1e-9) {
          const sq = Math.sqrt(disc);
          for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
            const py = oy + t * dy;
            if (t > 0 && py >= BODY_Y0 && py <= BODY_Y1) {
              const px = ox + t * dx;
              const pz = oz + t * dz;
              const theta = Math.atan2(pz, px);
              let base = 0.63 + bodyTexture(theta, py);
              if (py > 1.34) base -= 0.13;
              consider(
                t,
                2 * px,
                -2 * (R_BOT + K_TAPER * (py - BODY_Y0)) * K_TAPER,
                2 * pz,
                base,
              );
            }
          }
        }
      }

      const cylinder = (r, y0, y1, baseFn, capTop) => {
        const A = dx * dx + dz * dz;
        if (A < 1e-9) return;
        const B = 2 * (ox * dx + oz * dz);
        const C = ox * ox + oz * oz - r * r;
        const disc = B * B - 4 * A * C;
        if (disc > 0) {
          const sq = Math.sqrt(disc);
          for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
            const py = oy + t * dy;
            if (t > 0 && py >= y0 && py <= y1) {
              const px = ox + t * dx;
              const pz = oz + t * dz;
              consider(t, px, 0, pz, baseFn(px, py, pz));
            }
          }
        }
        if (capTop && Math.abs(dy) > 1e-9) {
          const t = (y1 - oy) / dy;
          const px = ox + t * dx;
          const pz = oz + t * dz;
          if (t > 0 && px * px + pz * pz <= r * r) {
            consider(t, 0, 1, 0, baseFn(px, y1, pz) + 0.05);
          }
        }
      };

      const discPlane = (y, r, base) => {
        if (Math.abs(dy) < 1e-9) return;
        const t = (y - oy) / dy;
        const px = ox + t * dx;
        const pz = oz + t * dz;
        if (t > 0 && px * px + pz * pz <= r * r) {
          consider(t, 0, 1, 0, base);
        }
      };

      cylinder(
        STRAW_R,
        STRAW_Y0,
        STRAW_Y1,
        (px, py) => 0.86 - 0.1 * Math.max(0, Math.min(1, (py - 1.6) / 1.0)),
        true,
      );
      discPlane(LID_TOP_Y1, LID_TOP_R, 0.95);
      cylinder(LID_TOP_R, LID_RIM_Y1, LID_TOP_Y1, () => 0.76, false);
      cylinder(LID_RIM_R, BODY_Y1, LID_RIM_Y1, () => 0.82, false);
      discPlane(BODY_Y1, LID_RIM_R, 0.55);
      cylinder(R_BOT + 0.035, BODY_Y0, BODY_Y0 + 0.13, () => 0.8, false);

      const cx = Math.floor(gx / ss);
      const cy = Math.floor(gy / ss);
      const i = cy * COLS + cx;
      if (bestT < Infinity) {
        vals[i] += bestVal / (ss * ss);
        hits[i] += 1 / (ss * ss);
      }
    }
  }
  return { vals, hits };
}

export default function CupCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    let raf = 0;
    let phase = 0;

    const draw = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const { vals, hits } = renderFrame(phase);
      const u = Math.max(w / (COLS * CELL_ASPECT), h / ROWS);
      const ox = (w - COLS * CELL_ASPECT * u) / 2;
      const oy = (h - ROWS * u) / 2;
      ctx.font = `${u}px "Courier New", Courier, monospace`;
      ctx.textBaseline = "top";
      let last = null;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          if (hits[i] <= 0.25) continue;
          const v = Math.max(0, Math.min(1, vals[i] / Math.max(hits[i], 1e-6)));
          const ci = Math.min(
            RAMP.length - 1,
            Math.floor(v * (RAMP.length - 1)),
          );
          const ch = RAMP[ci];
          if (ch === " ") continue;
          const f = 0.25 + 0.75 * v;
          const color = `rgb(${Math.round(IVORY[0] * f * 255)},${Math.round(
            IVORY[1] * f * 255,
          )},${Math.round(IVORY[2] * f * 255)})`;
          if (color !== last) {
            ctx.fillStyle = color;
            last = color;
          }
          ctx.fillText(ch, ox + x * CELL_ASPECT * u, oy + y * u);
        }
      }
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      draw();
    } else {
      const t0 = performance.now();
      const loop = (now) => {
        phase = (((now - t0) / SPIN_MS) * Math.PI * 2) % (Math.PI * 2);
        draw();
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
  }, []);

  return <canvas ref={ref} className="ascii-field" aria-hidden="true" />;
}
