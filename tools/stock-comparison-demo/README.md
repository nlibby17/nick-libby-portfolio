# Stock Comparison demo window

This folder holds the source of the demo window embedded in
the portfolio site's Stock Research Assistant page. The
window is the app's **real Stock Comparison view**, lifted
from the Stock-Research-Assistant repo's frontend
(`frontend/src/`), not a recreation.

## Provenance

`src/` contains unmodified copies of the app frontend's
`format.mjs`, `scoring-help.mjs`, `style.css`, and
`theme.css`, plus a copy of `app.jsx` carrying the four
patches below. `package.json` and `package-lock.json` are
the app frontend's own. The data file,
`public/demo/stock-comparison/report.json`, is the full
dashboard payload of a real run of the app in demo mode,
exported unedited (see `export-report.py`).

## Patches to app.jsx (complete list)

1. **Data source.** `fetch("/api/report", ...)` becomes
   `fetch("report.json", ...)`. On a static site there is
   no backend. The baked payload is the same JSON the
   endpoint returns. This is the app's demo-mode data,
   synthetic and labeled as such by the app itself.
2. **Start page.** The initial page state is `"comparison"`
   instead of `"home"`.
3. **Navigation removed.** The side navigation rail is not
   rendered. The window shows one view only.
4. **Page locked.** The view switch renders `<Comparison>`
   unconditionally, so nothing inside the window can
   navigate to Home, Top Candidates, Research, or Advanced.
5. **Top notices removed.** The synthetic-data banner and
   the data-quality warnings notice are not rendered. Demo
   data is disclosed on the portfolio page around the
   window instead. This also removes the warnings notice's
   "Review in Advanced" button.
6. **Coverage disclosure removed.** The collapsible
   Coverage table under the score bars is not rendered.
   Coverage still shows in the arena and on the bars.
7. **Research & sources tab removed.** The demo run has no
   research notes, so the tab showed only empty states.
8. **Semicolon pass.** Prose semicolons in the view's
   visible text were replaced with periods, per the site's
   no-semicolons rule. The metric help strings in
   `scoring-help.mjs` got the same pass.

Host-page adaptation (in the generated `index.html`, not in
the app's files): with the rail gone, `main`'s left padding
drops from 124px to a symmetric 44px, with a mobile variant.

## Known inert or empty spots

- None known after patches 5 to 7. The spots that were
  inert or empty in the first build (the Advanced button,
  the research tab) were removed outright in the editing
  pass rather than left in place.

## Rebuild

```
npm ci
node build-demo.mjs        # writes public/demo/stock-comparison/
```

Refresh the data with `export-report.py` (needs the app
clone and a completed demo run there).
