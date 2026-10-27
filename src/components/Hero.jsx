import OrbitRing from "./OrbitRing.jsx";

/*
  Hero order per Nick's direction (Oct 25, 2026): ornament,
  role, tagline with only its bottom decorator, then the
  visual assembly directly above the featured project card.
  The giant NICK LIBBY hero header was removed by Nick's
  call the same day: the site title and the nav brand
  already carry his name. The old SVG sunburst behind the
  hero is retired: the homepage backdrop is now a fixed
  ASCII sunburst (App-level AsciiField, variant "sun") that
  stays put wherever you scroll.

  The Projects / Contact / About jumper buttons that sat
  under the tagline were retired by Nick on Oct 27, 2026:
  Projects is the next scroll down, Contact moved into the
  header as a LinkedIn link of its own, and About was
  already linked in the header and below the projects. The
  hero now ends at the divider and hands straight off to
  the orbit ring.

  The visual assembly is the orbit ring (Oct 26, 2026): the
  project icons travel a tilted ellipse over the sun, each
  with its particle halo, driven by lib/iconRegistry.js.
  It replaces the lone spinning cup and its disc, which
  served as the hero from Stage 2 until the ring landed.
*/
export default function Hero() {
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
