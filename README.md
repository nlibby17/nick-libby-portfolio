# Nick Libby | Portfolio

Personal portfolio site of Nick Libby, a data analytics student at SNHU working
in Python, SQL, and Excel. Built with React and Vite, hosted on Cloudflare Pages.

**Live site:** https://nick-libby-portfolio.pages.dev

## Featured projects

- [Every Dunkin' in Massachusetts](https://nick-libby-portfolio.pages.dev/projects/dunkin-massachusetts)
- [Stock Research Assistant](https://nick-libby-portfolio.pages.dev/projects/stock-research-assistant)
- [Portal x Titanfall Movement Mod](https://nick-libby-portfolio.pages.dev/projects/portal-titanfall)

An [About page](https://nick-libby-portfolio.pages.dev/about) covers the
longer version.

## ASCII art and the converter

The site is ASCII art inspired, and its backdrops are generated with the
converter that lives in this repo at
`tools/ascii-converter/ascii_convert.py`. It turns images into per-cell
colored ASCII grids (plain text or JSON) with selectable character ramps and
sampling modes.

## Layout of this repo

- `src/` holds the site itself: pages, components (including the canvas
  fields and the cube toy), and project data in `src/data/projects.js`
- `public/demo/` holds the self-contained Stock Research Assistant demo
- `public/images/` holds screenshots and stills used on the project pages
- `tools/ascii-converter/` holds the image-to-ASCII converter described above

## Develop

```bash
npm install
npm run dev
```

## Build and deploy

```bash
npm run build
```

Output goes to `dist/`. Cloudflare Pages builds from `main` on every push
(build command `npm run build`, output directory `dist`, `NODE_VERSION=22`)
and serves the result at the address above.

## Status

Live and complete as of October 2026. The design, content, and project pages
are finished, and the site is where new portfolio work will land as it ships.
