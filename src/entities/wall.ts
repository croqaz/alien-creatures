import { vec, Vec2 } from "../utils/vec2";

/** Side length of a single wall tile, in world units. Clicks snap to this grid. */
export const WALL_SIZE = 40;

/**
 * The two kinds of solid block. Both block movement identically; they differ
 * only in toughness. A `stone` block is the classic impassable wall — utterly
 * indestructible, nothing damages it. A `dirt` block is a soft barrier any
 * creature can grind through (DIRT_HP) when it's hemmed in by one.
 */
export type BlockType = "stone" | "dirt";

/** Hit points a fresh dirt block absorbs before it crumbles. */
export const DIRT_HP = 100;

/** Full health of a block of `type`. Stone is indestructible, so its HP is just
 * a nominal full bar that never drops (see `dig`, which never touches stone). */
export function blockMaxHp(type: BlockType): number {
  return type === "dirt" ? DIRT_HP : Infinity;
}

export interface Wall {
  cx: number; // grid cell coordinates
  cy: number;
  position: Vec2; // centre in world space
  size: number;
  type: BlockType;
  hp: number;
  maxHp: number;
}

/**
 * A sparse grid of solid blocks. Tiles are snapped to a fixed grid so that
 * clicking/dragging builds contiguous barriers, and lookups during collision
 * are O(1) per creature regardless of how many blocks exist. Stone blocks are
 * indestructible; dirt blocks carry health and crumble once a creature pinned
 * against one grinds it down (see `dig`).
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

  /**
   * Place a block at the tile under the given position. Idempotent (safe to
   * drag-paint). `type` picks stone (default) or dirt; `hp` overrides the
   * starting health (used when restoring a partly-dug block from a save).
   */
  placeAt(worldPos: Vec2, type: BlockType = "stone", hp?: number): void {
    const { cx, cy } = this.cellOf(worldPos);
    const k = this.key(cx, cy);
    if (this.cells.has(k)) return;
    const maxHp = blockMaxHp(type);
    this.cells.set(k, {
      cx,
      cy,
      position: vec(
        cx * WALL_SIZE + WALL_SIZE / 2,
        cy * WALL_SIZE + WALL_SIZE / 2,
      ),
      size: WALL_SIZE,
      type,
      hp: hp ?? maxHp,
      maxHp,
    });
  }

  /** Remove the block under the given position, if any. Returns true if one was removed. */
  removeAt(worldPos: Vec2): boolean {
    const { cx, cy } = this.cellOf(worldPos);
    return this.cells.delete(this.key(cx, cy));
  }

  /**
   * Deal `amount` damage to every *dirt* block a circle at `pos` (with the given
   * `radius`) is touching, removing any whose health reaches zero. Stone is
   * indestructible and skipped entirely. A small reach margin means a creature
   * pinned flush against a block — pushed to exactly touching by `resolveCircle`
   * — still chips away at it. Returns true if it bit into any dirt this call.
   */
  dig(pos: Vec2, radius: number, amount: number): boolean {
    if (this.cells.size === 0 || amount <= 0) return false;
    const reach = radius + 2; // a hair past the body so flush contact still bites
    const half = WALL_SIZE / 2;
    const minCx = Math.floor((pos.x - reach) / WALL_SIZE);
    const maxCx = Math.floor((pos.x + reach) / WALL_SIZE);
    const minCy = Math.floor((pos.y - reach) / WALL_SIZE);
    const maxCy = Math.floor((pos.y + reach) / WALL_SIZE);

    let hit = false;
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const k = this.key(cx, cy);
        const block = this.cells.get(k);
        if (!block || block.type !== "dirt") continue; // stone is indestructible
        const wx = cx * WALL_SIZE + half;
        const wy = cy * WALL_SIZE + half;
        const closestX = Math.max(wx - half, Math.min(pos.x, wx + half));
        const closestY = Math.max(wy - half, Math.min(pos.y, wy + half));
        const dx = pos.x - closestX;
        const dy = pos.y - closestY;
        if (dx * dx + dy * dy >= reach * reach) continue;
        block.hp -= amount;
        hit = true;
        if (block.hp <= 0) this.cells.delete(k);
      }
    }
    return hit;
  }

  /**
   * The nearest *breakable* (dirt) block within `maxDist` of `pos`, or null.
   * A trapped creature heads for this to tunnel its way out. Only the local
   * grid window the range could reach is scanned, so cost is bounded by the
   * range, not the map size. Stone is skipped — it can't be dug through.
   */
  nearestDirtBlock(pos: Vec2, maxDist: number): Wall | null {
    if (this.cells.size === 0) return null;
    const span = Math.ceil(maxDist / WALL_SIZE) + 1;
    const ccx = Math.floor(pos.x / WALL_SIZE);
    const ccy = Math.floor(pos.y / WALL_SIZE);
    let best: Wall | null = null;
    let bestDist = maxDist;
    for (let cx = ccx - span; cx <= ccx + span; cx++) {
      for (let cy = ccy - span; cy <= ccy + span; cy++) {
        const block = this.cells.get(this.key(cx, cy));
        if (!block || block.type !== "dirt") continue;
        const dx = block.position.x - pos.x;
        const dy = block.position.y - pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) {
          bestDist = d;
          best = block;
        }
      }
    }
    return best;
  }

  /**
   * True if a creature at `pos` is boxed into a small enclosed pocket — i.e. the
   * open floor it can reach (flood-filled across the grid, treating the arena
   * edges as walls) is smaller than `cap` cells. A creature roaming the open map
   * fills past `cap` almost immediately and is reported free; one sealed inside a
   * pen fills only its little interior and is reported trapped. The fill is
   * capped, so cost is bounded by `cap` regardless of map or pen size — callers
   * throttle how often they ask. `clearanceRadius` keeps the test consistent
   * with pathfinding's notion of which cells the body actually fits through.
   */
  isEnclosed(
    pos: Vec2,
    clearanceRadius: number,
    arenaWidth: number,
    arenaHeight: number,
    cap: number,
  ): boolean {
    const cols = Math.ceil(arenaWidth / WALL_SIZE);
    const rows = Math.ceil(arenaHeight / WALL_SIZE);
    const clearance = Math.max(2, clearanceRadius - 2);
    const half = WALL_SIZE / 2;
    const walkable = (cx: number, cy: number): boolean => {
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
      return !this.overlaps(
        vec(cx * WALL_SIZE + half, cy * WALL_SIZE + half),
        clearance,
      );
    };

    const startCx = Math.floor(pos.x / WALL_SIZE);
    const startCy = Math.floor(pos.y / WALL_SIZE);
    const visited = new Set<number>([startCy * cols + startCx]);
    const queue: number[] = [startCy * cols + startCx];
    for (let head = 0; head < queue.length; head++) {
      if (visited.size >= cap) return false; // reached open space — not boxed in
      const idx = queue[head]!;
      const cx = idx % cols;
      const cy = (idx - cx) / cols;
      const neighbours: [number, number][] = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (!walkable(nx, ny)) continue;
        const nIdx = ny * cols + nx;
        if (visited.has(nIdx)) continue;
        visited.add(nIdx);
        queue.push(nIdx);
      }
    }
    return true; // explored a fully-bounded region smaller than cap — enclosed
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
