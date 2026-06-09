import { Vec2, vec } from "../utils/vec2";

/** Side length of a single wall tile, in world units. Clicks snap to this grid. */
export const WALL_SIZE = 40;

export interface Wall {
  cx: number; // grid cell coordinates
  cy: number;
  position: Vec2; // centre in world space
  size: number;
}

/**
 * A sparse grid of solid wall tiles. Tiles are snapped to a fixed grid so that
 * clicking/dragging builds contiguous barriers, and lookups during collision
 * are O(1) per creature regardless of how many walls exist.
 */
export class WallGrid {
  private cells = new Map<string, Wall>();

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  private cellOf(worldPos: Vec2): { cx: number; cy: number } {
    return {
      cx: Math.floor(worldPos.x / WALL_SIZE),
      cy: Math.floor(worldPos.y / WALL_SIZE),
    };
  }

  /** Place a wall at the tile under the given position. Idempotent (safe to drag-paint). */
  placeAt(worldPos: Vec2): void {
    const { cx, cy } = this.cellOf(worldPos);
    const k = this.key(cx, cy);
    if (this.cells.has(k)) return;
    this.cells.set(k, {
      cx,
      cy,
      position: vec(
        cx * WALL_SIZE + WALL_SIZE / 2,
        cy * WALL_SIZE + WALL_SIZE / 2,
      ),
      size: WALL_SIZE,
    });
  }

  /** Remove the wall tile under the given position, if any. Returns true if one was removed. */
  removeAt(worldPos: Vec2): boolean {
    const { cx, cy } = this.cellOf(worldPos);
    return this.cells.delete(this.key(cx, cy));
  }

  all(): Wall[] {
    return [...this.cells.values()];
  }

  /** Remove every wall tile (used when wiping the map on import). */
  clear(): void {
    this.cells.clear();
  }

  isEmpty(): boolean {
    return this.cells.size === 0;
  }

  /** True if a circle at `pos` with the given radius overlaps any wall tile. */
  overlaps(pos: Vec2, radius: number): boolean {
    if (this.cells.size === 0) return false;
    const half = WALL_SIZE / 2;
    const minCx = Math.floor((pos.x - radius) / WALL_SIZE);
    const maxCx = Math.floor((pos.x + radius) / WALL_SIZE);
    const minCy = Math.floor((pos.y - radius) / WALL_SIZE);
    const maxCy = Math.floor((pos.y + radius) / WALL_SIZE);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        if (!this.cells.has(this.key(cx, cy))) continue;
        const wx = cx * WALL_SIZE + half;
        const wy = cy * WALL_SIZE + half;
        const closestX = Math.max(wx - half, Math.min(pos.x, wx + half));
        const closestY = Math.max(wy - half, Math.min(pos.y, wy + half));
        const dx = pos.x - closestX;
        const dy = pos.y - closestY;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }

  /**
   * Push a circle (a creature) out of any wall tiles it overlaps and return the
   * corrected position. Only the handful of cells the circle could touch are
   * checked. Mutates nothing.
   */
  resolveCircle(pos: Vec2, radius: number): Vec2 {
    if (this.cells.size === 0) return pos;

    let { x, y } = pos;
    const half = WALL_SIZE / 2;
    const minCx = Math.floor((x - radius) / WALL_SIZE);
    const maxCx = Math.floor((x + radius) / WALL_SIZE);
    const minCy = Math.floor((y - radius) / WALL_SIZE);
    const maxCy = Math.floor((y + radius) / WALL_SIZE);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        if (!this.cells.has(this.key(cx, cy))) continue;
        const wx = cx * WALL_SIZE + half;
        const wy = cy * WALL_SIZE + half;

        // Closest point on the tile to the circle centre.
        const closestX = Math.max(wx - half, Math.min(x, wx + half));
        const closestY = Math.max(wy - half, Math.min(y, wy + half));
        const dx = x - closestX;
        const dy = y - closestY;
        const distSq = dx * dx + dy * dy;
        if (distSq >= radius * radius) continue;

        if (distSq > 1e-6) {
          // Overlapping an edge/corner: push straight out along the contact normal.
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          x += (dx / dist) * push;
          y += (dy / dist) * push;
        } else {
          // Centre is inside the tile: eject along the shallowest face.
          const penLeft = x - (wx - half);
          const penRight = wx + half - x;
          const penTop = y - (wy - half);
          const penBottom = wy + half - y;
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) x = wx - half - radius;
          else if (minPen === penRight) x = wx + half + radius;
          else if (minPen === penTop) y = wy - half - radius;
          else y = wy + half + radius;
        }
      }
    }

    return vec(x, y);
  }
}
