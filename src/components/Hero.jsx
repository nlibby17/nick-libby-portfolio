import AsciiField from "./AsciiField";

/*
  Hero order per Nick's direction (Oct 25, 2026): ornament,
  role, tagline with only its bottom decorator, Projects /
  Contact / About buttons, then the cup directly above the
  featured project card. The giant NICK LIBBY hero header was
  removed by Nick's call the same day: the site title and the
  nav brand already carry his name. The old SVG sunburst
  behind the hero is retired: the homepage backdrop is now a
  fixed ASCII sunburst (App-level AsciiField, variant "sun")
  that stays put wherever you scroll.
  The cup is still the stand-in ASCII; the converted photoreal
  cup replaces it once Nick's specifications land.
*/
export default function Hero({ onNavigate }) {
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <header className="hero">
      <p className="ornament" aria-hidden="true">
        ◆ ◆ ◆
      </p>
      <p className="role">Aspiring Data Analyst</p>
      <div className="pitch-frame">
        <p className="pitch">No data too tangled, no question too small.</p>
        <hr className="deco-divider" aria-hidden="true" />
      </div>
      <div className="cta">
        <a className="btn btn-solid" href="#projects" onClick={scrollTo("projects")}>
          Projects
        </a>
        <a className="btn" href="#contact" onClick={scrollTo("contact")}>
          Contact
        </a>
        <a
          className="btn"
          href="/about"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/about");
          }}
        >
          About
        </a>
      </div>
      <div
        className="cup-stage"
        role="img"
        aria-label="ASCII art of an iced coffee cup, tilted, with a straw"
      >
        <AsciiField variant="cup" opacity={1} />
      </div>
    </header>
  );
}
