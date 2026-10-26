/*
  AsciiPipe: one connector of the Dunkin page's build
  pipeline (Nick, Oct 25, 2026). The pipes are characters
  like everything else on the site: a flange row of equals
  signs and body rows with a highlight column, painted
  through a text-clipped gradient so the cylinder shading
  and the shine live in the paint, not the glyphs. Every
  pipe runs the same 5 second shine animation with no
  delay, so a diagonal light pass sweeps all of them in
  sync. direction "up" puts the flange on top, "down"
  puts it at the bottom where the pipe points.
*/
const FLANGE = "====================";
const BODY = "|     ||           |";
const ROWS = 5;

export default function AsciiPipe({ direction = "up" }) {
  const body = Array.from({ length: ROWS }, () => BODY);
  const lines = direction === "up" ? [FLANGE, ...body] : [...body, FLANGE];
  return (
    <pre className="ascii-pipe" aria-hidden="true">
      {lines.join("\n")}
    </pre>
  );
}
