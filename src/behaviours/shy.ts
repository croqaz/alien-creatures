import { Vec2, vec, sub, normalize, scale, add, distance } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { seekFoodIfHungry, seekHealingIfHurt } from "./survival";

export class ShyBehaviour implements Behaviour {
  readonly name = "Shy";
  private wanderAngle = Math.random() * Math.PI * 2;
  private readonly fearRadius = 150;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    // Flee from nearby creatures
    let fleeForce = vec(0, 0);
    let threats = 0;

    for (const e of nearby) {
      if (e === creature || !e.isAlive) continue;
      if (!("species" in e)) continue; // only flee from creatures
      const d = distance(creature.position, e.position);
      if (d < this.fearRadius && d > 0) {
        const away = normalize(sub(creature.position, e.position));
        const urgency = 1 - d / this.fearRadius;
        fleeForce = add(fleeForce, scale(away, urgency));
        threats++;
      }
    }

    if (threats > 0) {
      creature.lastActivity = `Fleeing (${threats} nearby)`;
      return creature.nav.flee(creature, fleeForce, world);
    }

    // No immediate danger: heal up if hurt, then feed if hungry, before idling.
    const healing = seekHealingIfHurt(creature, nearby, world);
    if (healing) return healing;
    const food = seekFoodIfHungry(creature, nearby, world);
    if (food) return food;

    // Wander gently
    creature.lastActivity = "Wandering";
    this.wanderAngle += (Math.random() - 0.5) * 0.4;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.4,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.4,
    );
  }
}
