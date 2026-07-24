/**
 * The selectable map dimensions offered by the start-up modal, split into two
 * independent axes:
 *
 *  - size  (small/medium/large) — how *much* map there is. A linear scale
 *    factor applied to both axes, so area scales with its square.
 *  - shape (wide/square/tall)   — the aspect ratio. The base dimensions below
 *    are tuned to keep roughly equal area across all three shapes of a given
 *    size, so picking a shape changes the proportions, not the amount of map.
 *
 * Medium + Wide is the default and lands near the historic 4000×3000 arena
 * (just a touch wider). Tall is Wide flipped on its side.
 *
 * This is the single source of truth for both the modal (which buttons to show,
 * with their live dimension hints) and the Game (which arena to build).
 */
export interface MapDimensions {
  readonly width: number;
  readonly height: number;
}

export type MapSizeKey = "tiny" | "small" | "medium" | "large" | "huge";
export type MapShapeKey = "wide" | "square" | "tall";

interface SizeDef {
  readonly label: string;
  /** Linear scale applied to the shape's base dimensions (medium = 1). */
  readonly scale: number;
}

interface ShapeDef {
  readonly label: string;
  /** Base width/height at medium scale; same area (~12M) across shapes. */
  readonly width: number;
  readonly height: number;
}

export const MAP_SIZES: Record<MapSizeKey, SizeDef> = {
  tiny: { label: "Tiny", scale: 0.35 },
  small: { label: "Small", scale: 0.6 },
  medium: { label: "Medium", scale: 1.0 },
  large: { label: "Large", scale: 1.6 },
  huge: { label: "Huge", scale: 2.5 },
};

export const MAP_SHAPES: Record<MapShapeKey, ShapeDef> = {
  // Wide is a touch wider than the old near-square arena (3:2 rather than 4:3).
  wide: { label: "Wide", width: 4200, height: 2800 },
  square: { label: "Square", width: 3500, height: 3500 },
  // Tall is Wide flipped, so its width/height are the wide values swapped.
  tall: { label: "Tall", width: 2800, height: 4200 },
};

export const DEFAULT_MAP_SIZE: MapSizeKey = "medium";
export const DEFAULT_MAP_SHAPE: MapShapeKey = "wide";

/**
 * Resolve a (size, shape) pair to concrete arena dimensions, scaling the
 * shape's base dimensions by the size factor and rounding to a tidy multiple of
 * 100 so the displayed numbers stay clean.
 */
export function mapDimensions(
  size: MapSizeKey,
  shape: MapShapeKey,
): MapDimensions {
  const scale = MAP_SIZES[size].scale;
  const base = MAP_SHAPES[shape];
  return {
    width: Math.round((base.width * scale) / 100) * 100,
    height: Math.round((base.height * scale) / 100) * 100,
  };
}

/** Dimensions used when no explicit choice is made (Medium + Wide). */
export const DEFAULT_DIMENSIONS = mapDimensions(
  DEFAULT_MAP_SIZE,
  DEFAULT_MAP_SHAPE,
);
