# ascii-converter

Image-to-ASCII converter built for this site's artwork (Oct 2026).
Samples a source image on a dense grid, picks a character per cell
from a brightness ramp, and colors each cell from the source.

Key options:
  --cols N        grid width in characters (render at target size;
                  do not stretch a small render up)
  --ramp fine|blade|plain
                  blade = stroke-shaped glyphs only, reads as
                  individual strokes instead of letterform mush
  --sample peak   blends local peak brightness into each cell so
                  thin bright features survive averaging
  --unsharp K     local contrast boost; separates shapes from gaps
  --blank T       cells darker than T render empty (keeps gaps dark)
  --json PATH     also emit grid data (lines + palette + per-cell
                  color indices) for the site's AsciiField canvas
                  component
  --txt PATH      also emit the plain character grid

Requires Python 3 + Pillow. Renders use Liberation Mono locally,
the metric twin of Courier New.
