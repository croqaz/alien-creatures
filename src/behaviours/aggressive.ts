import { Vec2, vec, sub, normalize, scale, distance } from '../utils/vec2';
import type { Behaviour } from './behaviour';
import type { Creature } from '../entities/creature';
import type { Entity, World } from '../entities/entity';
import { seekFoodIfHungry } from './survival';

export class AggressiveBehaviour implements Behaviour {
  readonly name = 'Aggressive';
  private wanderAngle = Math.random() * Math.PI * 2;
  private readonly chaseRadius = 250;

  decide(creature: Creature, nearby: Entity[], _world: World): Vec2 {
    // When hungry, food comes before picking fights.
    const food = seekFoodIfHungry(creature, nearby);
    if (food) return food;

    // Chase nearest creature
    let target: Creature | null = null;
    let targetDist = Infinity;

    for (const e of nearby) {
      if (e === creature || !e.isAlive) continue;
      if (!('species' in e)) continue;
      const d = distance(creature.position, e.position);
      if (d < this.chaseRadius && d < targetDist) {
        targetDist = d;
        target = e as Creature;
      }
    }

    if (target) {
      creature.lastActivity = `Chasing ${target.species}`;
      const dir = sub(target.position, creature.position);
      return scale(normalize(dir), creature.maxSpeed);
    }

    // Wander aggressively
    creature.lastActivity = 'Prowling';
    this.wanderAngle += (Math.random() - 0.5) * 0.8;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.6,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.6,
    );
  }
}
