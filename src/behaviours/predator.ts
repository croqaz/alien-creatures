import { distance, vec, Vec2 } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { Food } from "../entities/food";
import { seekFoodIfHungry, seekHealingIfHurt } from "./survival";

export class PredatorBehaviour implements Behaviour {
  readonly name = "Predator";
  private wanderAngle = Math.random() * Math.PI * 2;
  private readonly huntRadius = 300;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    // When wounded, find a heart before doing anything else.
    const healing = seekHealingIfHurt(creature, nearby, world);
    if (healing) return healing;

    // When hungry, head straight for the nearest food before hunting.
    const food = seekFoodIfHungry(creature, nearby, world);
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
      } else if ("radius" in e && e.radius < creature.radius) {
        // Never hunt a loyal ally (same faction packs hunt together).
        if ("species" in e && creature.alliedWith(e as Creature)) continue;
        // Prefer creatures over food
        if (d < targetDist || target instanceof Food) {
          targetDist = d;
          target = e;
        }
      }
    }

    if (target) {
      creature.lastActivity =
        target instanceof Food
          ? "Moving towards food"
          : `Hunting ${(target as Creature).species}`;
      return creature.nav.seek(creature, target.position, world);
    }

    // Prowl
    creature.lastActivity = "Prowling";
    this.wanderAngle += (Math.random() - 0.5) * 0.3;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.5,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.5,
    );
  }
}
