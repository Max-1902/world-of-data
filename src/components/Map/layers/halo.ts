/**
 * Outline for point marks drawn over satellite imagery. The imagery can be anything from dark ocean to pale desert, so
 * a mark's fill alone cannot hold 3:1 against it everywhere; an opaque white ring separates it from dark ground and
 * the fill separates it from the ring. This is a mitigation, not a guarantee, which is why marks that carry a category
 * also say it in a popup and in the layer's panel.
 */
export const MARK_HALO = {
  'circle-stroke-color': '#ffffff',
  'circle-stroke-width': 1.5,
  'circle-stroke-opacity': 0.95,
} as const
