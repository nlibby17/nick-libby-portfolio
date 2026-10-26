import VideoEmbed from "../components/VideoEmbed.jsx";
import SprinkleField from "../components/SprinkleField.jsx";
import CandleField from "../components/CandleField.jsx";
import AsciiPipe from "../components/AsciiPipe.jsx";

/*
  ProjectPage: one centered template for every project,
  driven entirely by src/data/projects.js. Optional fields
  layer on per project without disturbing the others: a
  video block under the stats, a pipeline of build steps
  rendered between sections (pipelineAfter counts the
  sections it follows), and a named ASCII backdrop field
  behind the content.
*/
export default function ProjectPage({ project, onNavigate }) {
  const renderSection = (section) => (
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
  );

  const pipelineNode = project.pipeline ? (
    <section className="pipeline" key="pipeline">
      <h2>{project.pipeline.heading}</h2>
      <div className="pipe-flow">
        {project.pipeline.steps.map((step, i) => (
          <div className="pipe-step" key={step.title}>
            <div className="pipe-run" aria-hidden="true">
              <AsciiPipe variant={i === 0 ? "down" : "double"} />
            </div>
            <h3 className="pipe-title">{step.title}</h3>
            <p>{step.body}</p>
          </div>
        ))}
        <div className="pipe-run pipe-run--end" aria-hidden="true">
          <AsciiPipe variant="double" />
        </div>
      </div>
    </section>
  ) : null;

  const pipeAt = project.pipeline
    ? (project.pipelineAfter ?? project.sections.length)
    : -1;
  const flow = [];
  project.sections.forEach((section, i) => {
    flow.push(renderSection(section));
    if (pipelineNode && i === pipeAt - 1) flow.push(pipelineNode);
  });
  if (pipelineNode && pipeAt >= project.sections.length) flow.push(pipelineNode);

  return (
    <main
      className={`page project-page${project.backdrop ? " has-backdrop" : ""}`}
      style={{ "--splash": project.splash }}
    >
      {project.backdrop === "sprinkles" && (
        <div className="project-bg" aria-hidden="true">
          <SprinkleField />
        </div>
      )}
      {project.backdrop === "candles" && (
        <div className="project-bg project-bg--candles" aria-hidden="true">
          <CandleField />
        </div>
      )}
      <div className="project-content">
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
        {project.status && (
          <p className="kicker" style={{ marginTop: "1.6rem" }}>
            {project.status}
          </p>
        )}
        <h1>{project.title}</h1>
        {project.lede && <p className="lede">{project.lede}</p>}

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

        {project.video && (
          <section>
            <h2>{project.video.heading}</h2>
            <p>{project.video.body}</p>
            <VideoEmbed
              videoId={project.video.id}
              poster={project.video.poster}
              label={project.video.label}
              posterAlt={project.video.posterAlt}
            />
          </section>
        )}

        {flow}
      </div>
    </main>
  );
}
