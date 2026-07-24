import { distance, vec, Vec2 } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { TrapLure } from "../entities/trap-lure";
import { damageCreature } from "../entities/creatures/void-pool";

/** Damage a Trap inflicts per bite. */
export const TRAP_DAMAGE = 50;

/** Seconds between bites once a Trap is chewing on its prey. */
const BITE_COOLDOWN = 0.6;

/**
 * How close (beyond its own body) an outsider must come before the Trap springs
 * and starts chasing. Small on purpose — the prey has to be right at the bait.
 */
const TRIGGER_MARGIN = 28;

/** Extra reach (beyond the two bodies touching) at which the jaws can land a bite. */
const BITE_MARGIN = 10;

/** Fraction of max speed the Trap creeps at while lying in wait (barely moving). */
const IDLE_SPEED_FRACTION = 0.12;

/**
 * The Trap: a Void ambusher that lies almost motionless, baiting a morsel of
 * food in its toothy maw. It looks completely harmless — it deals no passive
 * contact damage at all, so other creatures aren't frightened off and hungry
 * ones come to feed. The instant an outsider strays within snapping distance the
 * jaws spring: the Trap chases the victim at full (Crawler) speed and bites it
 * for TRAP_DAMAGE every BITE_COOLDOWN seconds for as long as it can stay on top
 * of it, until the prey dies or escapes its perception — then it settles back to
 * lie in wait.
 *
 * Bites are dealt directly (not through the body-overlap contact system) so they
 * land reliably the moment the Trap reaches its prey, regardless of how slow it
 * is. And because it never raises its `damage` stat, prey don't read it as a
 * threat and panic-flee — which is what lets a slow Trap actually keep up and
 * finish a kill.
 */
export class TrapBehaviour implements Behaviour {
  readonly name = "Trap";
  private wanderAngle = Math.random() * Math.PI * 2;
  /** The bait pinned in the maw; respawned whenever it's eaten or lost. */
  private lure: TrapLure | null = null;
  /** The victim the Trap has sprung on, or null while it lies in wait. */
  private prey: Creature | null = null;
  /** Sim-time (`world.time`) at which the Trap may land its next bite. */
  private nextBite = 0;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    this.ensureLure(creature, world);

    // Let go of a victim that has died or slipped out of perception, dropping
    // back to lying in wait.
    if (
      this.prey &&
      (!this.prey.isAlive ||
        distance(creature.position, this.prey.position) >
          creature.perceptionRadius)
    ) {
      this.prey = null;
    }

    // Spring the moment any outsider strays within snapping distance of the bait.
    if (!this.prey) this.prey = this.nearestVictim(creature, nearby);

    if (this.prey) {
      // Sprung: chase at full speed and chew whenever we're on top of the prey.
      const bitten = this.maybeBite(creature, this.prey, world);
      creature.lastActivity = bitten
        ? `Biting ${this.prey.species}`
        : `Chasing ${this.prey.species}`;
      return creature.nav.seek(creature, this.prey.position, world);
    }

    // Lying in wait: barely drifting, dragging its baited mouth along with it.
    creature.lastActivity = "Lying in wait";
    this.wanderAngle += (Math.random() - 0.5) * 0.4;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * IDLE_SPEED_FRACTION,
      Math.sin(this.wanderAngle) * creature.maxSpeed * IDLE_SPEED_FRACTION,
    );
  }

  /**
   * Bite `prey` for TRAP_DAMAGE if it's within the jaws' reach and the bite
   * cooldown has elapsed. Returns true on a bite this tick. The hit goes through
   * the shared damage chokepoint and provokes the victim, so retaliators fight
   * back exactly as they would against a melee attacker.
   */
  private maybeBite(creature: Creature, prey: Creature, world: World): boolean {
    const reach = creature.radius + prey.radius + BITE_MARGIN;
    if (distance(creature.position, prey.position) > reach) return false;
    if (world.time < this.nextBite) return false;
    damageCreature(prey, TRAP_DAMAGE, world);
    prey.provoke();
    this.nextBite = world.time + BITE_COOLDOWN;
    return true;
  }

  /** Make sure a live bait sits in the maw, spawning a fresh one if it's gone. */
  private ensureLure(creature: Creature, world: World) {
    if (this.lure && this.lure.isAlive) return;
    this.lure = new TrapLure(creature);
    world.spawn(this.lure);
  }

  /** Nearest non-allied living creature within snapping distance, or null. */
  private nearestVictim(creature: Creature, nearby: Entity[]): Creature | null {
    const trigger = creature.radius + TRIGGER_MARGIN;
    let victim: Creature | null = null;
    let best = Infinity;
    for (const e of nearby) {
      if (e === creature || !e.isAlive || !(e instanceof Creature)) continue;
      if (creature.alliedWith(e)) continue; // never snap at its own kind
      const d = distance(creature.position, e.position);
      if (d < trigger && d < best) {
        best = d;
        victim = e;
      }
    }
    return victim;
  }
}
