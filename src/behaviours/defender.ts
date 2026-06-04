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
  // A predator this close (or closer) makes the defender stand its ground and
  // attack, rather than waiting to actually be struck.
  private readonly fightRadius = 170;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    // Find the nearest genuine threat (something that deals contact damage).
    let threat: Creature | null = null;
    let threatDist = Infinity;
    for (const e of nearby) {
      if (e === creature || !e.isAlive) continue;
      if (!("species" in e)) continue; // only creatures are threats
      const other = e as Creature;
      if (other.damage <= 0) continue; // only the genuinely dangerous
      const d = distance(creature.position, other.position);
      if (d < threatDist) {
        threatDist = d;
        threat = other;
      }
    }

    // A predator within fight range provokes the defender into retaliating
    // (provoke() arms its retaliation damage). Once provoked it keeps charging
    // the nearest threat until the retaliation window lapses, so it doesn't
    // flip back to fleeing the instant the predator drifts a hair out of range.
    if (threat && threatDist <= this.fightRadius) {
      creature.provoke();
    }
    if (threat && creature.isProvoked) {
      creature.lastActivity = `Fighting back against ${threat.species}`;
      return creature.nav.seek(creature, threat.position, world);
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
