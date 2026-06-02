import { Vec2, vec, sub, normalize, scale, distance } from '../utils/vec2';
import type { Behaviour } from './behaviour';
import type { Creature } from '../entities/creature';
import type { Entity, World } from '../entities/entity';
import { Food } from '../entities/food';
import { seekFoodIfHungry } from './survival';

export class PredatorBehaviour implements Behaviour {
  readonly name = 'Predator';
  private wanderAngle = Math.random() * Math.PI * 2;
  private readonly huntRadius = 300;

  decide(creature: Creature, nearby: Entity[], _world: World): Vec2 {
    // When hungry, head straight for the nearest food before hunting.
    const food = seekFoodIfHungry(creature, nearby);
    if (food) return food;

    // Hunt creatures smaller than self, or eat food
    let target: Entity | null = null;
    let targetDist = Infinity;

    for (const e of nearby) {
      if (e === creature || !e.isAlive) continue;
      const d = distance(creature.position, e.position);
      if (d > this.huntRadius) continue;

      if (e instanceof Food) {
        if (d < targetDist) {
          targetDist = d;
          target = e;
        }
      } else if ('radius' in e && e.radius < creature.radius) {
        // Prefer creatures over food
        if (d < targetDist || target instanceof Food) {
          targetDist = d;
          target = e;
        }
      }
    }

    if (target) {
      creature.lastActivity = target instanceof Food ? 'Moving towards food' : `Hunting ${(target as Creature).species}`;
      const dir = sub(target.position, creature.position);
      return scale(normalize(dir), creature.maxSpeed);
    }

    // Prowl
    creature.lastActivity = 'Prowling';
    this.wanderAngle += (Math.random() - 0.5) * 0.3;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.5,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.5,
    );
  }
}
