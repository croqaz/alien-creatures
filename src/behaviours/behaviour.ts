import { Vec2 } from "../utils/vec2";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";

export interface Behaviour {
  readonly name: string;
  decide(creature: Creature, nearby: Entity[], world: World): Vec2;
}
