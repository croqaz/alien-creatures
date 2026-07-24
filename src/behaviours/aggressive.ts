import { distance, vec, Vec2 } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { seekFoodIfHungry, seekHealingIfHurt } from "./survival";

export class AggressiveBehaviour implements Behaviour {
  readonly name = "Aggressive";
  private wanderAngle = Math.random() * Math.PI * 2;
  private readonly chaseRadius = 250;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    // When wounded, patch up at a heart before picking fights.
    const healing = seekHealingIfHurt(creature, nearby, world);
    if (healing) return healing;

    // When hungry, food comes before picking fights.
    const food = seekFoodIfHungry(creature, nearby, world);
    if (food) return food;

    // Chase nearest creature
    let target: Creature | null = null;
    let targetDist = Infinity;

    for (const e of nearby) {
      if (e === creature || !e.isAlive) continue;
      if (!("species" in e)) continue;
      const other = e as Creature;
      if (creature.alliedWith(other)) continue; // never hunt a loyal ally
      const d = distance(creature.position, other.position);
      if (d < this.chaseRadius && d < targetDist) {
        targetDist = d;
        target = other;
      }
    }

    if (target) {
      creature.lastActivity = `Chasing ${target.species}`;
      return creature.nav.seek(creature, target.position, world);
    }

    // Wander aggressively
    creature.lastActivity = "Prowling";
    this.wanderAngle += (Math.random() - 0.5) * 0.8;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.6,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.6,
    );
  }
}
