#!/usr/bin/env python3
"""
ascii_convert.py - image-to-ASCII converter (v1, brute-force density route)

Method (agreed with Nick, Oct 25, 2026):
  sample the source on a dense grid, pick a character per cell from a
  brightness ramp, color each cell from the source. Blade-preserving
  knobs fight the "one blob of mass" failure Nick flagged:
    --sample peak   : cell brightness blends the mean with a local peak
                      (thin bright blades survive instead of averaging out)
    --unsharp K     : local contrast boost on the brightness grid so
                      blade edges separate from the dark gaps between them
    --blank T       : cells under brightness T render empty; the dark
                      gaps stay dark, which is what keeps blades individual
  Rotation/stroke fitting is deliberately NOT in v1; density first.

Outputs a PNG render (per-cell color on near-black) for inspection,
plus a plain .txt of the grid when --txt is given.

Font note: renders use Liberation Mono locally, the metric twin of
Courier New, the traditional ASCII art face Nick asked for.
"""
import argparse
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_PATH = "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"
RAMP = " .·:;+*x%#@"          # 11 levels, sparse-friendly
# Blade ramp: stroke-shaped glyphs only, ordered by ink. Round letterforms
# (o, a, e, s) read as texture mush at small sizes; strokes read as blades.
RAMP_BLADE = " .·:'|/\\!1ljrfxt+*%#@"
RAMP_FINE = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
BG = (10, 10, 9)
CHAR_ASPECT = 0.6  # Liberation Mono advance width / line height


def build_grids(img, cols, sample, unsharp, peak_weight=0.55):
    """Return (brightness grid L image, color grid RGB image) at cell resolution."""
    w, h = img.size
    rows = max(1, round(cols * (h / w) * CHAR_ASPECT))
    mean = img.resize((cols, rows), Image.BOX)
    if sample == "peak":
        peak = img.filter(ImageFilter.MaxFilter(5)).resize((cols, rows), Image.BOX)
        bright = Image.blend(mean.convert("L"), peak.convert("L"), peak_weight)
    else:
        bright = mean.convert("L")
    if unsharp > 0:
        blur = bright.filter(ImageFilter.GaussianBlur(2))
        bright = Image.eval(
            bright, lambda p: p
        )  # placeholder, real unsharp below via point ops on merged arrays
        # unsharp via PIL: bright + k*(bright - blur), done per-pixel with numpy-free loop
        bp = bright.load()
        lp = blur.load()
        for y in range(rows):
            for x in range(cols):
                v = bp[x, y] + unsharp * (bp[x, y] - lp[x, y])
                bp[x, y] = max(0, min(255, int(v)))
    return bright, mean, rows


def render(img_path, out_path, cols, ramp_name, sample, unsharp, gamma,
           blank, color_gain, font_px, txt_path=None, peak_weight=0.55,
           json_path=None):
    img = Image.open(img_path).convert("RGB")
    ramp = {"fine": RAMP_FINE, "blade": RAMP_BLADE}.get(ramp_name, RAMP)
    bright, color, rows = build_grids(img, cols, sample, unsharp, peak_weight)
    bp = bright.load()
    cp = color.load()
    cell_w = max(1, round(font_px * CHAR_ASPECT))
    out = Image.new("RGB", (cols * cell_w, rows * font_px), BG)
    d = ImageDraw.Draw(out)
    font = ImageFont.truetype(FONT_PATH, font_px)
    lines = []
    palette = []
    palette_idx = {}
    cells = []
    top = len(ramp) - 1
    for y in range(rows):
        row_chars = []
        row_cells = []
        for x in range(cols):
            v = bp[x, y] / 255.0
            v = v ** gamma
            r, g, b = cp[x, y]
            r = min(255, int(r * color_gain))
            g = min(255, int(g * color_gain))
            b = min(255, int(b * color_gain))
            if v < blank:
                row_chars.append(" ")
                row_cells.append(-1)
                continue
            idx = min(top, int(v * len(ramp)))
            ch = ramp[idx]
            row_chars.append(ch)
            # quantize color to an rgb332 palette index for compact JSON
            key = ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6)
            if key not in palette_idx:
                qr = ((r >> 5) * 255) // 7
                qg = ((g >> 5) * 255) // 7
                qb = ((b >> 6) * 255) // 3
                palette_idx[key] = len(palette)
                palette.append(f"#{qr:02x}{qg:02x}{qb:02x}")
            row_cells.append(palette_idx[key])
            d.text((x * cell_w, y * font_px), ch,
                   font=font, fill=(r, g, b))
        lines.append("".join(row_chars))
        cells.append(row_cells)
    out.save(out_path)
    if txt_path:
        with open(txt_path, "w") as f:
            f.write("\n".join(lines))
    if json_path:
        import json
        with open(json_path, "w") as f:
            json.dump({"cols": cols, "rows": rows, "lines": lines,
                       "palette": palette, "cells": cells}, f,
                      separators=(",", ":"))
    print(f"{out_path}: {cols}x{rows} cells, {out.size[0]}x{out.size[1]} px")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--cols", type=int, default=320)
    ap.add_argument("--ramp", choices=["plain", "fine", "blade"], default="fine")
    ap.add_argument("--peak", type=float, default=0.55)
    ap.add_argument("--sample", choices=["mean", "peak"], default="peak")
    ap.add_argument("--unsharp", type=float, default=0.8)
    ap.add_argument("--gamma", type=float, default=0.85)
    ap.add_argument("--blank", type=float, default=0.045)
    ap.add_argument("--color-gain", type=float, default=1.25)
    ap.add_argument("--font-px", type=int, default=12)
    ap.add_argument("--txt", default=None)
    ap.add_argument("--json", default=None)
    a = ap.parse_args()
    render(a.src, a.out, a.cols, a.ramp, a.sample, a.unsharp, a.gamma,
           a.blank, a.color_gain, a.font_px, a.txt, a.peak, a.json)
