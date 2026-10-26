import blueGrid from "../assets/portal-flank-blue-grid.json";
import orangeGrid from "../assets/portal-flank-orange-grid.json";
import { CELL_ASPECT } from "./cupGeometry.js";

/*
  Shared portal geometry (Oct 26, 2026): the one place
  that knows where the Portal page flank portals stand.
  PortalFlank draws from it and the companion cube tests
  its teleports against it, so the art and the physics
  can never drift apart.

  The mouth numbers were measured off the converted
  grids: the dark inner void of the blue ring spans 11
  of its 29 columns and 32 of its 50 rows, centered a
  touch right of the ring box center, and the orange
  ring's void spans 14 of 31 columns and 34 of 50 rows,
  centered a touch left. Those leans come from the
  inward turn in the source art.
*/
export const PORTAL_CONTENT_W = 1152; // the site's --page-width, 72 rem
export const PORTAL_MIN_MARGIN = 120;

const aspectOf = (grid) => (grid.cols * CELL_ASPECT) / grid.rows;
export const PORTAL_ASPECTS = {
  blue: aspectOf(blueGrid),
  orange: aspectOf(orangeGrid),
};

const MOUTH = {
  blue: { cxOff: 0.052, cyOff: -0.01, hwFrac: 0.19, hhFrac: 0.32 },
  orange: { cxOff: -0.065, cyOff: -0.03, hwFrac: 0.226, hhFrac: 0.34 },
};

function side(aspect, mouth, W, H, margin, isLeft) {
  let ringW = Math.min(margin * 1.15, 330);
  let ringH = ringW / aspect;
  if (ringH > H * 0.94) {
    ringH = H * 0.94;
    ringW = ringH * aspect;
  }
  const cx = isLeft ? margin / 2 + 4 : W - margin / 2 - 4;
  const cy = H / 2;
  return {
    cx,
    cy,
    ringW,
    ringH,
    mouthCx: cx + mouth.cxOff * ringW,
    mouthCy: cy + mouth.cyOff * ringH,
    mouthHW: mouth.hwFrac * ringW,
    mouthHH: mouth.hhFrac * ringH,
  };
}

/*
  Returns null when the viewport leaves under
  PORTAL_MIN_MARGIN beside the content column, which is
  the same condition that hides the flanks themselves.
*/
export function computePortalLayout(W, H) {
  const margin = (W - PORTAL_CONTENT_W) / 2;
  if (margin < PORTAL_MIN_MARGIN) return null;
  return {
    left: side(PORTAL_ASPECTS.blue, MOUTH.blue, W, H, margin, true),
    right: side(PORTAL_ASPECTS.orange, MOUTH.orange, W, H, margin, false),
  };
}
