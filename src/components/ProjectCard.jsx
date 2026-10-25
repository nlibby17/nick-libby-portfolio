export default function ProjectCard({ project, onNavigate }) {
  const href = `/projects/${project.slug}`;
  return (
    <a
      className={`card deco-corners${project.featured ? " deco-corners--strong" : ""}${project.wide ? " card-wide" : ""}`}
      style={{ "--splash": project.splash }}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
    >
      {project.status && <span className="status">{project.status}</span>}
      <h3>{project.title}</h3>
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
