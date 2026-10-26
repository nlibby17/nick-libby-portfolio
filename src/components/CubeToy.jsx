import { useEffect, useRef, useState } from "react";
import cubeGrid from "../assets/companion-cube-grid.json";
import { CELL_ASPECT } from "../lib/cupGeometry.js";
import { shade } from "../lib/discParticles.js";
import { computePortalLayout } from "../lib/portalGeometry.js";

/*
  CubeToy: the companion cube (Nick's design, settled
  Oct 26, 2026, full spec in stage2-research). An ASCII
  companion cube rests on the floor of the Portal page
  under a small "drag me" label. It can be grabbed,
  dragged, and thrown, and it teleports through the
  flank portals using the shared portal geometry, the
  same numbers PortalFlank draws from.

  The art is Nick's own companion cube picture run
  through the site's converter over a hard four tone
  prep at 46 columns, approved by him at page scale.

  Settled rules baked in here:
  - The label dismissal lasts for this mount of the page
    only. State, not storage.
  - The cube rides above the page content on its own
    fixed layer. Only the cube itself takes pointer
    events, the wrapper lets clicks pass through.
  - Portal transit is an instant teleport on first
    contact with the inner mouth ellipse, expanded by
    half the cube radius. No clipping.
  - Parity: the horizontal offset mirrors across the
    pair and the vertical offset stays put, so top
    enters and top exits, and world velocity carries
    through untouched. A front entry exits the other
    front heading toward page center, a back entry
    exits the other back heading away, where the solid
    screen edge catches it.
  - A held cube that touches a portal zaps through at
    its current velocity, and the grab breaks the
    instant it goes through (Nick's correction after
    live play, Oct 26): the cube drops with whatever
    velocity it was travelling at, and it can be caught
    again mid flight, either by a fresh press or by the
    still held pointer reaching it.
  - Sprites are baked once in three palettes, idle,
    hover, and lit for held. No filters, no per frame
    recoloring. The loop sleeps when the cube rests.
*/
const SPR_W = 112;
const SPR_H = Math.round((SPR_W * cubeGrid.rows) / (cubeGrid.cols * CELL_ASPECT));
const HW = SPR_W / 2;
const HH = SPR_H / 2;
const RAD = (HW + HH) / 2; // working radius for portal contact
const BAKE_U = 12;
const GRAV = 600;
const FALL_CAP = 700;
const REST = 0.42;

function hexRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// The converted palette has no fixed heart slot, so the
// lit variant finds the heart family by hue: anything
// clearly pink gets pushed toward hot pink.
function isPink(hex) {
  const [r, g, b] = hexRgb(hex);
  return r - Math.max(g, b) > 40 && r > 90;
}

function hotPink(hex) {
  const [r, g, b] = hexRgb(hex);
  const mix = (v, target) => Math.round(v + (target - v) * 0.45);
  return `rgb(${mix(r, 255)}, ${mix(g, 150)}, ${mix(b, 185)})`;
}

function bakeSprite(variant) {
  const u = BAKE_U;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(cubeGrid.cols * CELL_ASPECT * u);
  cv.height = Math.ceil(cubeGrid.rows * u);
  const ctx = cv.getContext("2d");
  ctx.font = `${u}px "Courier New", Courier, monospace`;
  ctx.textBaseline = "top";
  const pal = cubeGrid.palette.map((base) => {
    if (variant === "lit") return isPink(base) ? hotPink(base) : shade(base, 1.22);
    if (variant === "hover") return shade(base, 1.13);
    return shade(base, 0.94);
  });
  let last = null;
  for (let y = 0; y < cubeGrid.rows; y++) {
    for (let x = 0; x < cubeGrid.cols; x++) {
      const ci = cubeGrid.cells[y][x];
      if (ci < 0) continue;
      const color = pal[ci];
      if (color !== last) {
        ctx.fillStyle = color;
        last = color;
      }
      ctx.fillText(cubeGrid.lines[y][x], x * CELL_ASPECT * u, y * u);
    }
  }
  return cv;
}

export default function CubeToy() {
  const layerRef = useRef(null);
  const moverRef = useRef(null);
  const canvasRef = useRef(null);
  const [showLabel, setShowLabel] = useState(true);
  const [present, setPresent] = useState(true);

  const s = useRef({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    angle: 0,
    angVel: 0,
    held: false,
    hovering: false,
    asleep: true,
    immune: false,
    onFloor: false,
    behind: false,
    grabOff: { x: 0, y: 0 },
    pointerId: null,
    canCatch: false,
    samples: [],
    layout: null,
    sprites: null,
    variant: "",
    raf: 0,
    running: false,
    last: 0,
  });

  useEffect(() => {
    const st = s.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    st.sprites = {
      idle: bakeSprite("idle"),
      hover: bakeSprite("hover"),
      lit: bakeSprite("lit"),
    };

    const drawVariant = (name) => {
      if (st.variant === name) return;
      st.variant = name;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(st.sprites[name], 0, 0, canvas.width, canvas.height);
    };
    st.drawVariant = drawVariant;
    drawVariant("idle");

    const floorY = () => window.innerHeight - HH - 6;

    const render = () => {
      const mover = moverRef.current;
      if (!mover) return;
      mover.style.transform = `translate3d(${st.pos.x - HW}px, ${st.pos.y - HH}px, 0)`;
      canvas.style.transform = `rotate(${st.angle}rad)`;
      const L = st.layout;
      let behind = false;
      if (L) {
        for (const key of ["left", "right"]) {
          const P = L[key];
          const backSide = key === "left" ? st.pos.x < P.mouthCx : st.pos.x > P.mouthCx;
          if (
            backSide &&
            Math.abs(st.pos.x - P.cx) < P.ringW / 2 + HW * 0.5 &&
            Math.abs(st.pos.y - P.cy) < P.ringH / 2
          ) {
            behind = true;
          }
        }
      }
      if (behind !== st.behind) {
        st.behind = behind;
        if (layerRef.current) layerRef.current.style.zIndex = behind ? "-1" : "5";
      }
    };
    st.render = render;

    const inMouth = (P, grow) => {
      const u = (st.pos.x - P.mouthCx) / (P.mouthHW + grow);
      const v = (st.pos.y - P.mouthCy) / (P.mouthHH + grow);
      return u * u + v * v <= 1;
    };

    const checkPortal = () => {
      const L = st.layout;
      if (!L || st.immune) return;
      for (const key of ["left", "right"]) {
        const P = L[key];
        if (!inMouth(P, RAD * 0.5)) continue;
        const E = L[key === "left" ? "right" : "left"];
        const rawU = Math.max(
          -0.95,
          Math.min(0.95, (st.pos.x - P.mouthCx) / P.mouthHW),
        );
        const rawV = Math.max(
          -0.95,
          Math.min(0.95, (st.pos.y - P.mouthCy) / P.mouthHH),
        );
        st.pos.x = E.mouthCx - rawU * E.mouthHW;
        st.pos.y = E.mouthCy + rawV * E.mouthHH;
        if (st.held) {
          // The grab breaks at the portal mouth. The cube
          // keeps the velocity it was travelling at and
          // falls, and the pointer can catch it again.
          st.held = false;
          st.canCatch = true;
          st.angVel = Math.max(-9, Math.min(9, st.vel.x * 0.004));
          st.samples = [];
          st.hovering = false;
          st.drawVariant("idle");
          if (
            st.pointerId !== null &&
            canvas.hasPointerCapture &&
            canvas.hasPointerCapture(st.pointerId)
          ) {
            try {
              canvas.releasePointerCapture(st.pointerId);
            } catch {
              // capture already gone, nothing to release
            }
          }
        }
        st.immune = true;
        break;
      }
    };
    st.checkPortal = checkPortal;

    const step = (dt) => {
      if (!st.held) {
        st.vel.y = Math.min(FALL_CAP, st.vel.y + GRAV * dt);
        const drag = Math.exp(-0.08 * dt);
        st.vel.x *= drag;
        st.pos.x += st.vel.x * dt;
        st.pos.y += st.vel.y * dt;
        st.angle += st.angVel * dt;

        const W = window.innerWidth;
        const fy = floorY();
        if (st.pos.x < HW) {
          st.pos.x = HW;
          if (st.vel.x < 0) st.vel.x = -st.vel.x * REST;
        }
        if (st.pos.x > W - HW) {
          st.pos.x = W - HW;
          if (st.vel.x > 0) st.vel.x = -st.vel.x * REST;
        }
        if (st.pos.y < HH) {
          st.pos.y = HH;
          if (st.vel.y < 0) st.vel.y = -st.vel.y * REST;
        }
        st.onFloor = false;
        if (st.pos.y >= fy) {
          st.pos.y = fy;
          if (st.vel.y > 0) {
            st.vel.y = st.vel.y > 60 ? -st.vel.y * REST : 0;
          }
          if (st.vel.y === 0) {
            st.onFloor = true;
            st.vel.x *= Math.exp(-1.6 * dt);
            st.angVel *= Math.exp(-3 * dt);
          }
        }
      }
      checkPortal();
      if (st.immune && st.layout) {
        const L = st.layout;
        if (!inMouth(L.left, RAD * 0.5) && !inMouth(L.right, RAD * 0.5)) {
          st.immune = false;
        }
      }
      if (st.onFloor && !st.held && Math.abs(st.vel.x) < 14) {
        const target = Math.round(st.angle / (Math.PI / 2)) * (Math.PI / 2);
        const diff = target - st.angle;
        st.angle += diff * Math.min(1, dt * 10);
        if (Math.abs(diff) < 0.01 && Math.abs(st.vel.x) < 6) {
          st.angle = target;
          st.vel.x = 0;
          st.angVel = 0;
          st.asleep = true;
        }
      }
      render();
    };

    const loop = (now) => {
      if (!st.running) return;
      const dt = Math.min(0.033, (now - st.last) / 1000 || 0.016);
      st.last = now;
      step(dt);
      if (st.asleep && !st.held) {
        st.running = false;
        return;
      }
      st.raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      st.asleep = false;
      if (!st.running) {
        st.running = true;
        st.last = performance.now();
        st.raf = requestAnimationFrame(loop);
      }
    };
    st.wake = wake;

    const onResize = () => {
      st.layout = computePortalLayout(window.innerWidth, window.innerHeight);
      setPresent(!!st.layout);
      if (st.layout) {
        st.pos.x = Math.max(HW, Math.min(window.innerWidth - HW, st.pos.x));
        st.pos.y = Math.min(st.pos.y, floorY());
        render();
      }
    };
    st.layout = computePortalLayout(window.innerWidth, window.innerHeight);
    setPresent(!!st.layout);
    // Spawn rule (Nick, Oct 26): the cube rests one cube
    // length to the right of where the middle body text
    // ends. The body text lives in the centered 68ch
    // sections, so its right edge is read once here at
    // mount, never inside the loop.
    const W0 = window.innerWidth;
    const sec = document.querySelector(".project-content section");
    const textRight = sec
      ? sec.getBoundingClientRect().right
      : W0 / 2 + 326;
    const spawnX = st.layout
      ? Math.max(HW + 8, Math.min(W0 - HW - 8, textRight + SPR_W + HW))
      : W0 / 2;
    st.pos = { x: spawnX, y: floorY() };
    render();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      st.running = false;
      cancelAnimationFrame(st.raf);
    };
  }, []);

  if (!present) return null;

  const sampleVelocity = () => {
    const st = s.current;
    const now = performance.now();
    const buf = st.samples.filter((p) => now - p.t < 130);
    if (buf.length < 2) return { x: 0, y: 0 };
    const a = buf[0];
    const b = buf[buf.length - 1];
    const dt = Math.max(1, b.t - a.t) / 1000;
    const cap = (v) => Math.max(-1600, Math.min(1600, v));
    return { x: cap((b.x - a.x) / dt), y: cap((b.y - a.y) / dt) };
  };

  const onDown = (e) => {
    const st = s.current;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    st.held = true;
    st.pointerId = e.pointerId;
    st.canCatch = false;
    st.immune = false;
    st.grabOff = { x: e.clientX - st.pos.x, y: e.clientY - st.pos.y };
    st.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    st.vel = { x: 0, y: 0 };
    st.angVel = 0;
    setShowLabel(false);
    st.drawVariant("lit");
    st.wake();
  };

  const onMove = (e) => {
    const st = s.current;
    if (!st.held) {
      // After a portal drop, the still held pointer can
      // catch the cube again in mid flight by reaching it.
      if (st.canCatch && e.buttons === 1) {
        st.held = true;
        st.pointerId = e.pointerId;
        st.canCatch = false;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // capture is a nicety here, the drag still works
        }
        st.grabOff = { x: e.clientX - st.pos.x, y: e.clientY - st.pos.y };
        st.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
        st.vel = { x: 0, y: 0 };
        st.angVel = 0;
        setShowLabel(false);
        st.drawVariant("lit");
        st.wake();
      }
      return;
    }
    const now = performance.now();
    st.samples.push({ x: e.clientX, y: e.clientY, t: now });
    if (st.samples.length > 6) st.samples.shift();
    st.vel = sampleVelocity();
    st.pos.x = e.clientX - st.grabOff.x;
    st.pos.y = e.clientY - st.grabOff.y;
    st.checkPortal();
    st.render();
  };

  const onUp = () => {
    const st = s.current;
    st.canCatch = false;
    if (!st.held) return;
    st.held = false;
    st.vel = sampleVelocity();
    st.angVel = Math.max(-9, Math.min(9, st.vel.x * 0.004));
    st.samples = [];
    st.drawVariant(st.hovering ? "hover" : "idle");
    st.wake();
  };

  return (
    <div className="cube-layer" ref={layerRef} aria-hidden="true">
      <div className="cube-mover" ref={moverRef} style={{ width: SPR_W, height: SPR_H }}>
        {showLabel && <div className="cube-label">drag me</div>}
        <canvas
          ref={canvasRef}
          className="cube-sprite"
          width={SPR_W * 2}
          height={SPR_H * 2}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerEnter={() => {
            s.current.hovering = true;
            if (!s.current.held) s.current.drawVariant("hover");
          }}
          onPointerLeave={() => {
            s.current.hovering = false;
            if (!s.current.held) s.current.drawVariant("idle");
          }}
        />
      </div>
    </div>
  );
}
