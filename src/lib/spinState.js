/*
  The one clock for the hero: CupCanvas owns the spin phase and
  publishes it (plus its latest rendered frame) here each tick;
  WarpedSunField reads it so the background deformation is
  always computed from the pose currently on screen.
*/
export const spinState = {
  phase: 0,
  frame: null, // { phase, vals, hits } from the cup renderer
};
