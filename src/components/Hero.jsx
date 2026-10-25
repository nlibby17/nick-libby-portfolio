import cupArt from "../assets/cup.txt?raw";

/*
  Hero order per Nick's direction (Oct 25, 2026): name (larger),
  role, tagline with only its bottom decorator, Projects/Contact
  buttons, then the cup directly above the featured project card.
  The old SVG sunburst behind the hero is retired: the homepage
  backdrop is now a fixed ASCII sunburst (App-level AsciiField,
  variant "sun") that stays put wherever you scroll.
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
      <h1>NICK LIBBY</h1>
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
      <pre className="cup" aria-label="ASCII art of an iced coffee cup">
        {cupArt}
      </pre>
    </header>
  );
}
