import { distance, normalize, sub, vec, Vec2 } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";

// Teleport-strike tuning.
const TELEPORT_COOLDOWN = 10; // seconds of sim time between blinks
/** Teleport reach (~half the 4000-wide arena). Doubles as the Charger's
 * perception radius so it can spot the prey it's able to blink onto. */
export const TELEPORT_RANGE = 2000;
const TELEPORT_MIN_RANGE = 220; // don't blink when already on top of the prey

/**
 * The Charger: a second boss — a colossal orange Lurker. Permanently aggressive,
 * it hunts the nearest creature and runs it down with brutal melee. Every ten
 * seconds it can blink across roughly half the map, teleporting right next to a
 * distant victim to close the gap instantly. Being infinite-energy it never
 * tires, and unlike the Voidspike Boss it has no second stage and summons no
 * minions — just relentless pursuit.
 */
export class ChargerBehaviour implements Behaviour {
  readonly name = "Charger";
  private wanderAngle = Math.random() * Math.PI * 2;
  private nextTeleportTime = 0;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    const target = this.nearestEnemy(creature, nearby);

    if (target) {
      const d = distance(creature.position, target.position);

      // Blink to a far victim when the strike is off cooldown and they're out
      // of reach of an ordinary chase but still within teleport range.
      if (
        world.time >= this.nextTeleportTime &&
        d > TELEPORT_MIN_RANGE &&
        d <= TELEPORT_RANGE
      ) {
        this.teleportTo(creature, target, world);
        this.nextTeleportTime = world.time + TELEPORT_COOLDOWN;
        creature.lastActivity = `Teleported onto ${target.species}`;
        return vec(0, 0);
      }

      creature.lastActivity = `Hunting ${target.species}`;
      return creature.nav.seek(creature, target.position, world);
    }

    // Nothing in sight: prowl slowly.
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

  /** Blink right next to `target`, landing just outside its body and ours so we
   * don't spawn overlapping. Snaps the position (clamped to the arena and pushed
   * clear of walls) and kills momentum so the strike lands clean. */
  private teleportTo(creature: Creature, target: Creature, world: World) {
    // Approach from the side the Charger is already on so it reads as a lunge.
    let dir = normalize(sub(creature.position, target.position));
    if (dir.x === 0 && dir.y === 0) dir = vec(1, 0);
    const off = creature.radius + target.radius + 8;
    let pos = {
      x: target.position.x + dir.x * off,
      y: target.position.y + dir.y * off,
    };
    pos = {
      x: Math.max(
        creature.radius,
        Math.min(world.arenaWidth - creature.radius, pos.x),
      ),
      y: Math.max(
        creature.radius,
        Math.min(world.arenaHeight - creature.radius, pos.y),
      ),
    };
    creature.position = world.walls.resolveCircle(pos, creature.radius);
    creature.velocity = vec(0, 0);
  }
}
