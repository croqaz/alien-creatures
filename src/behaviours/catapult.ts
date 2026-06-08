import { Vec2, vec, sub, normalize, scale, add, distance } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { Fireball } from "../entities/fireball";

// Ranged attack tuning — identical to the Voidspike Boss's fireballs.
const FIREBALL_DAMAGE = 95;
const FIREBALL_SPEED = 340;
const FIREBALL_RANGE = 780; // won't bother firing past this
const FIREBALL_COOLDOWN = 0.8; // seconds of sim time between shots

/**
 * The Catapult: a third boss — a colossal purple Lurker. Permanently aggressive,
 * it hunts the nearest creature outside its faction and lobs fireballs exactly
 * like the Voidspike Boss, at the same rate. It deals no contact damage at all —
 * a pure artillery boss. Being infinite-energy it never tires, and it has no
 * second stage and summons no minions.
 */
export class CatapultBehaviour implements Behaviour {
  readonly name = "Catapult";
  private wanderAngle = Math.random() * Math.PI * 2;
  private nextFireTime = 0;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    const target = this.nearestEnemy(creature, nearby);

    if (target) {
      const d = distance(creature.position, target.position);

      // Fire when off cooldown and the target is in range.
      if (world.time >= this.nextFireTime && d <= FIREBALL_RANGE) {
        this.shoot(creature, target, world);
        this.nextFireTime = world.time + FIREBALL_COOLDOWN;
      }

      creature.lastActivity = `Hunting ${target.species}`;
      return creature.nav.seek(creature, target.position, world);
    }

    // Nothing to fight: prowl slowly.
    creature.lastActivity = "Prowling";
    this.wanderAngle += (Math.random() - 0.5) * 0.4;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.5,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.5,
    );
  }

  /** Nearest living creature that isn't a loyal ally, within perception. */
  private nearestEnemy(creature: Creature, nearby: Entity[]): Creature | null {
    let target: Creature | null = null;
    let best = Infinity;
    for (const e of nearby) {
      if (e === creature || !e.isAlive) continue;
      if (!("species" in e)) continue;
      const other = e as Creature;
      if (creature.alliedWith(other)) continue;
      const d = distance(creature.position, other.position);
      if (d < best) {
        best = d;
        target = other;
      }
    }
    return target;
  }

  /** Lob a fireball from the Catapult's rim toward `target`. */
  private shoot(creature: Creature, target: Creature, world: World) {
    const dir = normalize(sub(target.position, creature.position));
    if (dir.x === 0 && dir.y === 0) return;
    const origin = add(creature.position, scale(dir, creature.radius + 18));
    world.spawn(
      new Fireball(
        origin,
        scale(dir, FIREBALL_SPEED),
        FIREBALL_DAMAGE,
        creature.faction,
        creature.id,
      ),
    );
  }
}
