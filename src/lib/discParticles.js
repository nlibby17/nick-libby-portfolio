/*
  The particle disc's shared data (Nick's design, Oct 25, 2026):
  the same letters and golds as the sun field, orbiting the
  cup's center of mass in a plane tilted slightly toward the
  viewer. Radii are stored as multiples of the sphere radius
  so the disc scales with the cup on any screen. Two canvases
  draw the two halves: far arc behind the cup, near arc in
  front. Seeded, so every layer and every load agrees.
*/
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

export const DISC_TILT = 0.8;
export const DISC_RIN = 0.75; // multiples of the sphere radius
export const DISC_ROUT = 1.36;
const OMEGA0 = 0.87; // rad/s at radius = sphere radius

export function buildParticles(sunGrid) {
  const rng = mulberry32(133233);
  const chars = [];
  const colors = [];
  sunGrid.cells.forEach((row, y) => {
    row.forEach((ci, x) => {
      if (ci >= 0) {
        chars.push(sunGrid.lines[y][x]);
        colors.push(sunGrid.palette[ci]);
      }
    });
  });
  const out = [];
  for (let i = 0; i < 950; i++) {
    out.push({
      rr: DISC_RIN + (DISC_ROUT - DISC_RIN) * Math.pow(rng(), 1.6),
      a0: rng() * Math.PI * 2,
      ch: chars[(rng() * chars.length) | 0],
      col: colors[(rng() * colors.length) | 0],
    });
  }
  return out;
}

export function discPoint(p, t, comX, comY, sphereR) {
  const rr = p.rr * sphereR;
  const om = OMEGA0 * Math.pow(1 / p.rr, 1.5); // Kepler: inner faster
  const a = p.a0 + om * t;
  return {
    x: comX + rr * Math.cos(a),
    y: comY + rr * Math.sin(a) * DISC_TILT,
    a,
    om,
    behind: Math.sin(a) < 0,
  };
}

export function shade(color, f) {
  let r, g, b;
  if (color[0] === "#") {
    const n = parseInt(color.slice(1), 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    const m = color.match(/[\d.]+/g);
    [r, g, b] = m.map(Number);
  }
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}
