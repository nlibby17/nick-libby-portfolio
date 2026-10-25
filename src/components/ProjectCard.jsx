import { useCallback, useEffect, useRef } from "react";

/*
  Title corruption, layered on the CSS VHS burst (Nick's
  addition, Oct 25, 2026): on hover entry, a handful of letters
  in the title flicker through glyphs from the site's own
  ASCII vocabulary and snap back to true, staggered, inside
  the same half-second. Cursor leaving mid-burst restores the
  exact title immediately; nothing can get stuck corrupted.
  Reduced motion skips it. The scramble is visual only: the
  heading keeps its true accessible name.
*/
const CORRUPT = "#%&@*+=/\\|";
const BURST_MS = 480;
const TICK_MS = 40;

export default function ProjectCard({ project, onNavigate }) {
  const href = `/projects/${project.slug}`;
  const titleRef = useRef(null);
  const timerRef = useRef(null);
  const origRef = useRef(null);

  const stopScramble = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (titleRef.current && origRef.current) {
      titleRef.current.textContent = origRef.current;
    }
  }, []);

  const startScramble = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = titleRef.current;
    if (!el) return;
    stopScramble();
    const original = project.title;
    origRef.current = original;
    const spots = [];
    for (let i = 0; i < original.length; i++) {
      if (original[i] !== " ") spots.push(i);
    }
    if (!spots.length) return;
    const count = Math.min(spots.length, original.length > 14 ? 4 : 3);
    const chosen = new Set();
    while (chosen.size < count) {
      chosen.add(spots[(Math.random() * spots.length) | 0]);
    }
    const healAt = new Map();
    for (const i of chosen) {
      healAt.set(i, 6 + ((Math.random() * 5) | 0)); // frames 6..10 of 12
    }
    let frame = 0;
    const frames = BURST_MS / TICK_MS;
    timerRef.current = setInterval(() => {
      frame += 1;
      if (frame >= frames) {
        stopScramble();
        return;
      }
      const chars = original.split("");
      for (const i of chosen) {
        if (frame < healAt.get(i)) {
          chars[i] = CORRUPT[(Math.random() * CORRUPT.length) | 0];
        }
      }
      el.textContent = chars.join("");
    }, TICK_MS);
  };

  useEffect(() => stopScramble, [stopScramble]);

  return (
    <a
      className={`card deco-corners deco-corners--quiet${project.wide ? " card-wide" : ""}`}
      style={{ "--splash": project.splash }}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      onMouseEnter={startScramble}
      onMouseLeave={stopScramble}
    >
      {project.status && <span className="status">{project.status}</span>}
      <h3 data-title={project.title} aria-label={project.title}>
        <span ref={titleRef} aria-hidden="true">
          {project.title}
        </span>
      </h3>
      <p className="tagline">{project.tagline}</p>

      {project.cardType === "stat" && (
        <div className="stat-row">
          {project.stats.map((s) => (
            <span className="stat" key={s.label}>
              <span className="value">{s.value}</span>
              <span className="label">{s.label}</span>
            </span>
          ))}
        </div>
      )}

      {project.cardType === "tool" && (
        <p className="ticker">
          {project.factors.map((f, i) => (
            <span key={f}>
              <span className="tick">▲</span> {f}
              {i < project.factors.length - 1 ? "  ·  " : ""}
            </span>
          ))}
        </p>
      )}

      {project.cardType === "buildlog" && (
        <ul className="log-lines">
          {project.log.map((line) => (
            <li key={line}>
              <span className="tick">▸</span> {line}
            </li>
          ))}
        </ul>
      )}
    </a>
  );
}
