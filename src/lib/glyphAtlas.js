/*
  Glyph sprite atlas (the research's performance prescription):
  drawing a character with fillText under a fresh rotation
  transform is the expensive way to move letters; browsers are
  built to stamp small pre-rendered images instead. Each sprite
  is one character in one color at one size and weight,
  rendered once and cached. Brightness reaches the atlas in
  buckets so the working set stays small. Callers draw sprites
  with setTransform + drawImage, no font or style churn in the
  per-frame loop.
*/
const cache = new Map();
const MAX_SPRITES = 6000;

export function glyphSprite(ch, colorCss, u, bold) {
  const key = `${ch}|${colorCss}|${bold ? 1 : 0}|${u.toFixed(1)}`;
  let sp = cache.get(key);
  if (sp) return sp;
  if (cache.size > MAX_SPRITES) cache.clear();
  const ss = 2; // supersample for cleaner rotated stamps
  sp = document.createElement("canvas");
  sp.width = Math.ceil(0.6 * u) * ss + 8;
  sp.height = Math.ceil(u) * ss + 8;
  const ctx = sp.getContext("2d");
  ctx.scale(ss, ss);
  ctx.font = `${bold ? "bold " : ""}${u}px "Courier New", Courier, monospace`;
  ctx.textBaseline = "top";
  ctx.fillStyle = colorCss;
  ctx.fillText(ch, 4 / ss + (0.6 * u - Math.floor(0.6 * u)) / 2, 4 / ss);
  sp._ss = ss;
  cache.set(key, sp);
  return sp;
}

export function drawSprite(ctx, sp, x, y, ang, stretch, dpr) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const k = dpr / sp._ss;
  ctx.setTransform(
    k * c * stretch,
    k * s * stretch,
    -k * s,
    k * c,
    dpr * x,
    dpr * y,
  );
  ctx.drawImage(sp, -sp.width / (2 * sp._ss), -sp.height / (2 * sp._ss));
}

export function bucket(v, step) {
  return Math.round(v / step) * step;
}
