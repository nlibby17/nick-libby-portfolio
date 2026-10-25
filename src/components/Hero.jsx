import cupArt from "../assets/cup.txt?raw";

/*
  Hero: sunburst behind (deco system), the detailed ASCII cup
  (cup.txt, 56 x 34, artist pass Oct 25, 2026), and the pitch
  line framed by deco dividers so it reads as a motto.
  The rotating type-wrapped cup replaces the static art in the
  hero polish stage; the ice cube drift is the first enhancement
  after that.
*/
export default function Hero() {
  const scrollTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <header className="hero deco-hero">
      <p className="ornament" aria-hidden="true">
        ◆ ◆ ◆
      </p>
      <h1>NICK LIBBY</h1>
      <p className="role">Aspiring Data Analyst</p>
      <pre className="cup" aria-label="ASCII art of an iced coffee cup">
        {cupArt}
      </pre>
      <div className="pitch-frame">
        <hr className="deco-divider" aria-hidden="true" />
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
      </div>
    </header>
  );
}
