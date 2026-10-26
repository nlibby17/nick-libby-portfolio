import swordsGrid from "../assets/swords-grid.json";
import portalGrid from "../assets/portal-grid.json";

/*
  The orbit ring's icon registry (Nick's modularity rule,
  Oct 25, 2026): one entry per project, and adding a project
  to the ring touches this file and the icon's asset, never
  the ring itself. The ring reads kind, label, halo color,
  and seed from here and spaces the icons evenly on its own,
  two opposite, three in thirds, and so on.

  kind "cup": the Dunkin cup, baked from the live geometry
  renderer (lib/cupGeometry.js) at a fixed pose.
  kind "grid": a converted ASCII grid asset (lines, palette,
  cells), the same shape the converter writes.

  Icons are not links (Nick, Oct 26, 2026). A link field can
  be added per entry when that changes.
*/
export const ICON_REGISTRY = [
  {
    id: "dunkin",
    label: "Dunkin' Route",
    kind: "cup",
    seed: 133233,
    haloTint: "#e6cf9e",
  },
  {
    id: "portal",
    label: "Portal Mod",
    kind: "grid",
    grid: portalGrid,
    seed: 2601,
    haloTint: "#bcd6ea",
    scale: 1,
  },
  {
    id: "stock",
    label: "Stock App",
    kind: "grid",
    grid: swordsGrid,
    seed: 7211,
    haloTint: "#b7cdb0",
  },
];
