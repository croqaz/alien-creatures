import { Entity, EntityKind } from "./entity";
import type { World } from "../core/world";
import type { Vec2 } from "../utils/math";
import { BUFF_DURATION, BUFF_RADIUS } from "../core/config";
import { Creature } from "./creature";

export enum BuffType {
  Shield = "shield",
  Speed = "speed",
  Dagger = "dagger",
}

export interface BuffConfig {
  type: BuffType;
  color: string;
  label: string;
  duration: number; // seconds
}

export const BUFF_CONFIGS: Record<BuffType, BuffConfig> = {
  [BuffType.Shield]: {
    type: BuffType.Shield,
    color: "#f0f0f0",
    label: "🛡 Shield",
    duration: BUFF_DURATION,
  },
  [BuffType.Speed]: {
    type: BuffType.Speed,
    color: "#fbbf24",
    label: "⚡ Speed",
    duration: BUFF_DURATION,
  },
  [BuffType.Dagger]: {
    type: BuffType.Dagger,
    color: "#f43f5e",
    label: "🗡 Dagger",
    duration: BUFF_DURATION,
  },
};

export class BuffEntity implements Entity {
  readonly kind = EntityKind.Buff;
  id = 0;
  position: Vec2;
  radius = BUFF_RADIUS;
  buffType: BuffType;
  duration: number;

  constructor(pos: Vec2, buffType: BuffType) {
    this.position = { x: pos.x, y: pos.y };
    this.buffType = buffType;
    this.duration = BUFF_CONFIGS[buffType].duration;
  }

  update(_dt: number, world: World): void {
    const entities = world.getEntitiesInRadius(this.position, this.radius + 20);
    for (const e of entities) {
      if (e instanceof Creature && e.health > 0) {
        const dx = e.position.x - this.position.x;
        const dy = e.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pickupRange = this.radius + e.radius + 4;

        if (dist <= pickupRange) {
          e.applyBuff(this.buffType, this.duration);
          world.remove(this);
          return;
        }
      }
    }
  }
}

/** Helper to create a buff entity at a given position */
export function createBuff(buffType: BuffType, pos: Vec2): BuffEntity {
  return new BuffEntity(pos, buffType);
}
