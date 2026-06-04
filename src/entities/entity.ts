import { Vec2 } from "../utils/vec2";
import type { WallGrid } from "./wall";

export interface Entity {
  id: number;
  position: Vec2;
  radius: number;
  isAlive: boolean;
  update(dt: number, world: World): void;
}

export interface World {
  entities: Entity[];
  getNearby(position: Vec2, radius: number): Entity[];
  /**
   * Queue a new entity to enter the world. Safe to call from inside an entity's
   * update (e.g. the boss spawning minions, or firing a projectile): the entity
   * joins the simulation after the current update pass, not mid-iteration.
   */
  spawn(entity: Entity): void;
  walls: WallGrid;
  arenaWidth: number;
  arenaHeight: number;
  time: number;
}

let nextId = 1;
export function generateId(): number {
  return nextId++;
}
