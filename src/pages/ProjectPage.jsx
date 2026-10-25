export default function ProjectPage({ project, onNavigate }) {
  return (
    <main className="page" style={{ "--splash": project.splash }}>
      <a
        className="backlink"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("/");
        }}
      >
        ← All projects
      </a>
      <p className="kicker" style={{ marginTop: "1.6rem" }}>
        {project.status ? project.status : "Project"}
      </p>
      <h1>{project.title}</h1>
      <p className="lede">{project.lede}</p>

      {project.stats && (
        <div className="stat-row" style={{ marginTop: "1.2rem" }}>
          {project.stats.map((s) => (
            <span className="stat" key={s.label}>
              <span className="value">{s.value}</span>
              <span className="label">{s.label}</span>
            </span>
          ))}
        </div>
      )}

      {project.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
          {section.images &&
            section.images.map((img) => (
              <figure key={img.src} style={{ margin: 0 }}>
                <img className="shot" src={img.src} alt={img.alt} />
                <figcaption className="caption">{img.caption}</figcaption>
              </figure>
            ))}
          {section.link && (
            <p>
              <a href={section.link.href} target="_blank" rel="noreferrer">
                {section.link.label}
              </a>
            </p>
          )}
        </section>
      ))}
    </main>
  );
}
