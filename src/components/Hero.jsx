/*
  Hero cup: static ASCII stand-in for Stage 1. The rotating
  type-wrapped cup (the Type Face mechanism) replaces this art
  in the hero polish stage; the ice cubes are the first
  enhancement after that.
*/
const CUP = String.raw`                //
                //
                //
___________________________
/_________________________\
| []         []           |
|       []        []      |
|   []        []          |
 |         []      []     |
 | []       []            |
 |      []      []        |
  |  []       []          |
  |       []      []      |
  |   []      []          |
  | []      []            |
   |     []    []         |
   \_____________________/`;

export default function Hero() {
  return (
    <header className="hero">
      <p className="ornament" aria-hidden="true">
        ◆ ◆ ◆
      </p>
      <h1>NICK LIBBY</h1>
      <p className="role">Aspiring Data Analyst</p>
      <pre className="cup" aria-label="ASCII art of an iced coffee cup">
        {CUP}
      </pre>
      <p className="pitch">No data too tangled, no question too small.</p>
      <div className="cta">
        <a
          className="btn btn-solid"
          href="#projects"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("projects")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Projects
        </a>
        <a
          className="btn"
          href="#contact"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("contact")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Contact
        </a>
      </div>
    </header>
  );
}
