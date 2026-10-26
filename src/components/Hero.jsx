import OrbitRing from "./OrbitRing.jsx";

/*
  Hero order per Nick's direction (Oct 25, 2026): ornament,
  role, tagline with only its bottom decorator, Projects /
  Contact / About buttons, then the visual assembly directly
  above the featured project card. The giant NICK LIBBY hero
  header was removed by Nick's call the same day: the site
  title and the nav brand already carry his name. The old
  SVG sunburst behind the hero is retired: the homepage
  backdrop is now a fixed ASCII sunburst (App-level
  AsciiField, variant "sun") that stays put wherever you
  scroll.

  The visual assembly is the orbit ring (Oct 26, 2026): the
  project icons travel a tilted ellipse over the sun, each
  with its particle halo, driven by lib/iconRegistry.js.
  It replaces the lone spinning cup and its disc, which
  served as the hero from Stage 2 until the ring landed.
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
        className="orbit-stage"
        role="img"
        aria-label="Project icons in orbit: the Dunkin' coffee cup and the Stock App's crossed swords, circling with particle halos"
      >
        <OrbitRing />
      </div>
    </header>
  );
}
