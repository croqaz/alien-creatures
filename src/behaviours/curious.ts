import { Vec2, vec, sub, normalize, scale, distance } from '../utils/vec2';
import type { Behaviour } from './behaviour';
import type { Creature } from '../entities/creature';
import type { Entity, World } from '../entities/entity';
import { survivalDrive, isHungry } from './survival';

export class CuriousBehaviour implements Behaviour {
  readonly name = 'Curious';
  private wanderAngle = Math.random() * Math.PI * 2;
  private readonly inspectRadius = 200;

  decide(creature: Creature, nearby: Entity[], _world: World): Vec2 {
    // Survival comes first: flee threats and feed when hungry.
    const survival = survivalDrive(creature, nearby);
    if (survival) return survival;

    // Hungry with no food in sight? Roam to search rather than freeze inspecting
    // a neighbour (otherwise two curious creatures stare at each other and starve).
    if (isHungry(creature)) {
      creature.lastActivity = 'Hungry, searching';
      this.wanderAngle += (Math.random() - 0.5) * 0.5;
      return vec(
        Math.cos(this.wanderAngle) * creature.maxSpeed * 0.5,
        Math.sin(this.wanderAngle) * creature.maxSpeed * 0.5,
      );
    }

    // Find nearest entity of any kind
    let nearestEntity: Entity | null = null;
    let nearestDist = Infinity;

    for (const e of nearby) {
      if (e === creature || !e.isAlive) continue;
      const d = distance(creature.position, e.position);
      if (d < this.inspectRadius && d < nearestDist) {
        nearestDist = d;
        nearestEntity = e;
      }
    }

    if (nearestEntity) {
      const label = 'species' in nearestEntity ? (nearestEntity as Creature).species : 'food';
      creature.lastActivity = `Inspecting ${label}`;
      const dir = sub(nearestEntity.position, creature.position);
      // Slow down as we get closer (curiosity, not aggression)
      const closeness = Math.max(0.2, nearestDist / this.inspectRadius);
      return scale(normalize(dir), creature.maxSpeed * closeness);
    }

    // Wander
    creature.lastActivity = 'Wandering';
    this.wanderAngle += (Math.random() - 0.5) * 0.5;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.4,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.4,
    );
  }
}
