import AsciiField from "../components/AsciiField";

/*
  About copy: Nick's approved draft (Oct 25, 2026), professional,
  no inflated claims, Google certificate deliberately out, WVS
  mentioned briefly and factually. Nick's edit pass is the gate
  for any change to this text.
  Layout per Nick's directives (Oct 25, 2026): the whole section
  centered, header included; the converted grass (blades C, the
  distinct-blades render he chose) lives behind the text card as
  a full-stage background, visible around the card's borders,
  text front and center on a solid panel. The field renders at
  page size from grid data; it is never a stretched image.
  The ASCII portrait joins this page when Nick supplies a
  source photo.
*/
export default function AboutPage() {
  return (
    <main className="page about-page">
      <div className="about-stage">
        <AsciiField opacity={0.6} />
        <div className="about-stage-content">
          <h1>About</h1>
          <div className="about-panel deco-corners deco-corners--quiet">
            <div className="about-copy">
              <p>
                I'm Nick Libby, an aspiring data analyst and a student in
                the data analytics program at Southern New Hampshire
                University, class of 2027. My core tools are Python, SQL,
                and Excel, and the work I enjoy most starts with a messy
                dataset and a real question.
              </p>
              <p>
                Recent projects include a recreation of every Dunkin'
                location in Massachusetts, built from multiple location
                data sources and resolved into a single route of 1,019
                stops and 2,356.9 miles; a stock research assistant that
                screens and ranks tickers; and a Portal mod, in progress,
                that rebuilds Titanfall-style movement inside Portal's
                engine.
              </p>
              <p>
                I am also working on a project using World Values Survey
                data. The aim is to see where moral judgments draw broad
                agreement across countries and where they split,
                especially as the harm in a scenario becomes less
                concrete.
              </p>
              <p>
                Alongside school, I work in security at a private boarding
                school. The job runs on observation, careful documentation,
                and a level head, and those habits carry straight into my
                analysis work.
              </p>
              <p>
                I'm preparing for a career in data analysis, and I am glad
                to talk with anyone about the projects above or about
                entry-level analyst work.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
