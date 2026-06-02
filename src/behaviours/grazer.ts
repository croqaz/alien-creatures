import { Vec2, vec, distance } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { Food } from "../entities/food";
import { survivalDrive } from "./survival";

export class GrazerBehaviour implements Behaviour {
  readonly name = "Grazer";
  private wanderAngle = Math.random() * Math.PI * 2;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    // Survival comes first: flee predators/aggressors before grazing.
    const survival = survivalDrive(creature, nearby, world);
    if (survival) return survival;

    // Look for nearest food
    let nearestFood: Food | null = null;
    let nearestDist = Infinity;
    for (const e of nearby) {
      if (e instanceof Food && e.isAlive) {
        const d = distance(creature.position, e.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearestFood = e;
        }
      }
    }

    if (nearestFood) {
      creature.lastActivity = "Moving towards food";
      return creature.nav.seek(creature, nearestFood.position, world);
    }

    // Wander
    creature.lastActivity = "Wandering";
    this.wanderAngle += (Math.random() - 0.5) * 0.6;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.5,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.5,
    );
  }
}
