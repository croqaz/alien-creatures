import type { Vec2 } from "../utils/math";
import type { World } from "../core/world";

export enum EntityKind {
  Creature = "creature",
  Food = "food",
  Spawner = "spawner",
  Buff = "buff",
}

export interface Entity {
  id: number;
  kind: EntityKind;
  position: Vec2;
  radius: number;
  update(dt: number, world: World): void;
}
