import { Camera } from "./camera";
import { Arena } from "./arena";
import { Input } from "./input";
import { Renderer } from "../rendering/renderer";
import { SpatialGrid } from "../utils/spatial-grid";
import { Entity, World } from "../entities/entity";
import { Creature } from "../entities/creature";
import { WallGrid } from "../entities/wall";
import { Vec2 } from "../utils/vec2";
import { DEFAULT_DIMENSIONS, type MapDimensions } from "./map-size";

export class Game implements World {
  camera = new Camera();
  arena: Arena;
  input: Input;
  entities: Entity[] = [];
  walls = new WallGrid();
  simSpeed = 1;
  time = 0;
  /** Creature highlighted by the Select tool; drawn with a ring. Cleared on death. */
  selected: Creature | null = null;

  /** Entities queued during an update pass, merged in once the pass finishes. */
  private pending: Entity[] = [];

  private renderer: Renderer;
  private grid: SpatialGrid;
  private canvas: HTMLCanvasElement;
  private lastTime = 0;
  private statsTimer = 0;
  private onStatsUpdate: (() => void) | null = null;

  get arenaWidth() {
    return this.arena.width;
  }
  get arenaHeight() {
    return this.arena.height;
  }

  constructor(
    canvas: HTMLCanvasElement,
    size: MapDimensions = DEFAULT_DIMENSIONS,
  ) {
    this.canvas = canvas;
    this.arena = new Arena(size.width, size.height);
    this.input = new Input(canvas, this.camera);
    const ctx = canvas.getContext("2d")!;
    this.renderer = new Renderer(ctx, canvas, this.camera, this.arena);
    this.grid = new SpatialGrid(this.arena.width, this.arena.height, 200);

    // Frame the whole arena so the chosen map is fully visible on startup.
    this.camera.fitTo(
      this.arena.width,
      this.arena.height,
      canvas.clientWidth,
      canvas.clientHeight,
    );
  }

  addEntity(entity: Entity) {
    this.entities.push(entity);
  }

  /**
   * Resize the arena to new bounds — used when importing a map (or loading a
   * template) saved at a different size, so the layout is restored exactly.
   * Rebuilds the spatial grid for the new bounds and refits the camera so the
   * whole map is framed.
   */
  resizeArena(width: number, height: number) {
    this.arena.resize(width, height);
    this.grid = new SpatialGrid(width, height, 200);
    this.camera.fitTo(
      width,
      height,
      this.canvas.clientWidth,
      this.canvas.clientHeight,
    );
  }

  /**
   * Wipe the map clean: every entity and wall, the current selection, and any
   * spawns queued this frame. Leaves `time` and `simSpeed` for the caller to
   * set (map import restores `time` and pauses afterwards).
   */
  clear() {
    this.entities = [];
    this.pending = [];
    this.walls.clear();
    this.selected = null;
  }

  /** World.spawn: queue an entity created mid-update; merged in after the pass. */
  spawn(entity: Entity) {
    this.pending.push(entity);
  }

  getNearby(position: Vec2, radius: number): Entity[] {
    return this.grid.getNearby(position, radius);
  }

  setStatsCallback(cb: () => void) {
    this.onStatsUpdate = cb;
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    requestAnimationFrame(this.loop);

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.1); // cap to avoid spiral
    dt *= this.simSpeed;

    this.time += dt;

    // Rebuild spatial grid
    this.grid.clear();
    for (const e of this.entities) {
      if (e.isAlive) this.grid.insert(e);
    }

    // Update entities
    for (const e of this.entities) {
      e.update(dt, this);
    }

    // Merge in anything spawned during the pass (boss minions, fireballs) so it
    // joins the sim on the next frame rather than mutating the list mid-update.
    if (this.pending.length > 0) {
      this.entities.push(...this.pending);
      this.pending.length = 0;
    }

    // Remove long-dead entities
    this.entities = this.entities.filter((e) => {
      if (e.isAlive) return true;
      if (e instanceof Creature && e.deathTime > 0) {
        return performance.now() - e.deathTime < 1000; // keep for fade
      }
      return false;
    });

    // Drop a selection that has since died, so we never ring a corpse.
    if (this.selected && !this.selected.isAlive) this.selected = null;

    // Render
    this.renderer.render(
      this.entities,
      this.walls.all(),
      this.time,
      this.selected,
    );

    // Stats update every 0.5s
    this.statsTimer += dt;
    if (this.statsTimer > 0.5) {
      this.statsTimer = 0;
      this.onStatsUpdate?.();
    }
  };
}
