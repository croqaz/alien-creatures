import { Vec2, vec, distance } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { Food } from "../entities/food";
import { survivalDrive } from "./survival";

/**
 * A peaceful grazer that refuses to be a pushover: it forages and flees like a
 * Grazer until something hostile actually strikes it, at which point it turns
 * and charges its attacker (see `Creature.retaliation`/`isProvoked`).
 */
export class DefenderBehaviour implements Behaviour {
  readonly name = "Defender";
  private wanderAngle = Math.random() * Math.PI * 2;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    // Once provoked, stop fleeing and chase down the nearest threat to fight back.
    if (creature.isProvoked) {
      let attacker: Creature | null = null;
      let nearestDist = Infinity;
      for (const e of nearby) {
        if (e === creature || !e.isAlive) continue;
        if (!("species" in e)) continue; // only creatures are threats
        const other = e as Creature;
        if (other.damage <= 0) continue; // only the genuinely dangerous
        const d = distance(creature.position, other.position);
        if (d < nearestDist) {
          nearestDist = d;
          attacker = other;
        }
      }
      if (attacker) {
        creature.lastActivity = `Fighting back against ${attacker.species}`;
        return creature.nav.seek(creature, attacker.position, world);
      }
    }

    // Otherwise behave like a grazer: flee looming predators, then forage.
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
