import type { Entity } from "../entities/entity";
import type { Creature } from "../entities/creature";
import { ARENA_WIDTH, ARENA_HEIGHT } from "./config";

export interface WallGrid {
  cells: boolean[][];
  cellSize: number;
  cols: number;
  rows: number;
}

export interface World {
  entities: Entity[];
  walls: WallGrid;
  arenaWidth: number;
  arenaHeight: number;
  time: number;
  spawn(entity: Entity): void;
  remove(entity: Entity): void;
  getEntitiesInRadius(
    pos: import("../utils/math").Vec2,
    radius: number,
  ): Entity[];
  getCreatures(): Creature[];
  nextId: number;
  spawnerInterval: number; // ms between spawns
}

export function createWorld(): World {
  const cellSize = 100;
  const cols = Math.ceil(ARENA_WIDTH / cellSize);
  const rows = Math.ceil(ARENA_HEIGHT / cellSize);
  const cells: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false),
  );

  const world: World = {
    entities: [],
    walls: { cells, cellSize, cols, rows },
    arenaWidth: ARENA_WIDTH,
    arenaHeight: ARENA_HEIGHT,
    time: 0,
    nextId: 1,
    spawnerInterval: 5000,

    spawn(entity: Entity): void {
      entity.id = this.nextId++;
      this.entities.push(entity);
    },

    remove(entity: Entity): void {
      const idx = this.entities.indexOf(entity);
      if (idx !== -1) {
        this.entities.splice(idx, 1);
      }
    },

    getEntitiesInRadius(pos, radius): Entity[] {
      const result: Entity[] = [];
      for (const e of this.entities) {
        const dx = e.position.x - pos.x;
        const dy = e.position.y - pos.y;
        if (dx * dx + dy * dy <= radius * radius) {
          result.push(e);
        }
      }
      return result;
    },

    getCreatures(): Creature[] {
      return this.entities.filter(
        (e): e is Creature => (e as Creature).species !== undefined,
      );
    },
  };

  return world;
}
