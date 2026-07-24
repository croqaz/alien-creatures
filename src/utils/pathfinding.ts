import { vec, Vec2 } from "./vec2";
import { WALL_SIZE, WallGrid } from "../entities/wall";

const HALF = WALL_SIZE / 2;
const SQRT2 = Math.SQRT2;

// Safety cap on A* node expansions. The largest arena is 6400x4800 = 160x120
// cells (~19200 nodes), so this comfortably covers a full search even on the
// large map while still bailing out cheaply if something pathological happens.
const MAX_EXPANSIONS = 20000;

// How far (in cells) we'll look for a clear cell when the requested start or
// goal sits inside a wall (e.g. food spawned flush against a barrier).
const SNAP_RADIUS = 4;

/** World-space centre of grid cell (cx, cy). */
function center(cx: number, cy: number): Vec2 {
  return vec(cx * WALL_SIZE + HALF, cy * WALL_SIZE + HALF);
}

/** A binary min-heap keyed by f-score, storing packed cell indices. */
class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.prio.push(priority);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent]! <= this.prio[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0]!;
    const lastItem = this.items.pop()!;
    const lastPrio = this.prio.pop()!;
    if (this.items.length > 0) {
      this.items[0] = lastItem;
      this.prio[0] = lastPrio;
      let i = 0;
      const n = this.items.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < n && this.prio[l]! < this.prio[smallest]!) smallest = l;
        if (r < n && this.prio[r]! < this.prio[smallest]!) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b]!, this.items[a]!];
    [this.prio[a], this.prio[b]] = [this.prio[b]!, this.prio[a]!];
  }
}

/**
 * A* search over the wall grid. Returns a list of world-space waypoints from
 * (just after) `start` up to `goal`, routing around walls, or `null` if no path
 * exists. `radius` is the navigating creature's body radius — cells whose centre
 * would put the body inside a wall are treated as impassable, giving natural
 * clearance so creatures don't try to squeeze through gaps too small for them.
 *
 * This is intentionally only run when a straight line to the goal is blocked
 * (see Navigator), so the cost of a search is paid rarely.
 */
export function findPath(
  start: Vec2,
  goal: Vec2,
  radius: number,
  walls: WallGrid,
  arenaWidth: number,
  arenaHeight: number,
): Vec2[] | null {
  const cols = Math.ceil(arenaWidth / WALL_SIZE);
  const rows = Math.ceil(arenaHeight / WALL_SIZE);
  const maxCx = cols - 1;
  const maxCy = rows - 1;

  const inBounds = (cx: number, cy: number) =>
    cx >= 0 && cy >= 0 && cx <= maxCx && cy <= maxCy;

  // Plan with a slightly trimmed radius so cells we genuinely fit in aren't
  // discarded by floating-point slop at the wall boundary.
  const clearance = Math.max(2, radius - 2);
  const walkable = (cx: number, cy: number) =>
    inBounds(cx, cy) && !walls.overlaps(center(cx, cy), clearance);

  /** Nearest walkable cell to (cx, cy) within SNAP_RADIUS rings, or null. */
  const snap = (cx: number, cy: number): { cx: number; cy: number } | null => {
    if (walkable(cx, cy)) return { cx, cy };
    for (let r = 1; r <= SNAP_RADIUS; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // ring only
          if (walkable(cx + dx, cy + dy)) return { cx: cx + dx, cy: cy + dy };
        }
      }
    }
    return null;
  };

  const rawGoalCx = Math.floor(goal.x / WALL_SIZE);
  const rawGoalCy = Math.floor(goal.y / WALL_SIZE);
  const start0 = snap(
    Math.floor(start.x / WALL_SIZE),
    Math.floor(start.y / WALL_SIZE),
  );
  const goal0 = snap(rawGoalCx, rawGoalCy);
  if (!start0 || !goal0) return null;

  // If the real goal cell was reachable, steer to the exact goal point at the
  // end rather than just the cell centre.
  const goalCellWalkable = goal0.cx === rawGoalCx && goal0.cy === rawGoalCy;

  const idx = (cx: number, cy: number) => cy * cols + cx;
  const startIdx = idx(start0.cx, start0.cy);
  const goalIdx = idx(goal0.cx, goal0.cy);

  if (startIdx === goalIdx) {
    return [goalCellWalkable ? { ...goal } : center(goal0.cx, goal0.cy)];
  }

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const open = new MinHeap();

  const octile = (cx: number, cy: number) => {
    const dx = Math.abs(cx - goal0.cx);
    const dy = Math.abs(cy - goal0.cy);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  };

  gScore.set(startIdx, 0);
  open.push(startIdx, octile(start0.cx, start0.cy));

  // (dx, dy, cost) for the 8 neighbours.
  const NEI: Array<[number, number, number]> = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, SQRT2],
    [1, -1, SQRT2],
    [-1, 1, SQRT2],
    [-1, -1, SQRT2],
  ];

  let expansions = 0;
  while (open.size > 0) {
    if (++expansions > MAX_EXPANSIONS) return null;
    const current = open.pop();
    if (current === goalIdx) {
      return reconstruct(
        cameFrom,
        current,
        cols,
        goalCellWalkable ? goal : null,
      );
    }
    const ccx = current % cols;
    const ccy = (current - ccx) / cols;
    const cg = gScore.get(current)!;

    for (const [dx, dy, cost] of NEI) {
      const nx = ccx + dx;
      const ny = ccy + dy;
      if (!walkable(nx, ny)) continue;
      // Disallow cutting across wall corners on diagonal moves.
      if (dx !== 0 && dy !== 0) {
        if (!walkable(ccx + dx, ccy) || !walkable(ccx, ccy + dy)) continue;
      }
      const nIdx = idx(nx, ny);
      const tentative = cg + cost;
      const known = gScore.get(nIdx);
      if (known === undefined || tentative < known) {
        gScore.set(nIdx, tentative);
        cameFrom.set(nIdx, current);
        open.push(nIdx, tentative + octile(nx, ny));
      }
    }
  }

  return null;
}

function reconstruct(
  cameFrom: Map<number, number>,
  goalIdx: number,
  cols: number,
  exactGoal: Vec2 | null,
): Vec2[] {
  const cells: number[] = [goalIdx];
  let cur = goalIdx;
  while (cameFrom.has(cur)) {
    cur = cameFrom.get(cur)!;
    cells.push(cur);
  }
  cells.reverse();
  // Drop the start cell — the creature is already there.
  cells.shift();

  const path = cells.map((c) => {
    const cx = c % cols;
    const cy = (c - cx) / cols;
    return center(cx, cy);
  });
  if (exactGoal && path.length > 0) path[path.length - 1] = { ...exactGoal };
  return path;
}
