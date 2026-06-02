import { Vec2 } from "../utils/vec2";

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
  arenaWidth: number;
  arenaHeight: number;
  time: number;
}

let nextId = 1;
export function generateId(): number {
  return nextId++;
}
