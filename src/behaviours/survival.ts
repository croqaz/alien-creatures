import { add, distance, normalize, scale, sub, vec, Vec2 } from "../utils/vec2";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { Food } from "../entities/food";
import { Heart } from "../entities/heart";
import { Fireball } from "../entities/fireball";

// How close a dangerous creature must be before we flee it.
const THREAT_RADIUS = 220;
// How close an incoming fireball must be before a creature scrambles to dodge.
const FIREBALL_DODGE_RADIUS = 200;
// Below this fraction of max energy, finding food takes priority over everything else.
const HUNGRY_FRACTION = 0.4;
// Below this fraction of max health, seeking out a healing heart kicks in.
const HURT_FRACTION = 0.6;

/** A creature is hungry when its energy drops low enough that starvation is a real risk. */
export function isHungry(creature: Creature): boolean {
  if (creature.infiniteEnergy) return false; // never spends energy, never hungry
  return creature.energy < creature.maxEnergy * HUNGRY_FRACTION;
}

/** A creature is hurt when it has taken enough damage to go looking for a heart. */
export function isHurt(creature: Creature): boolean {
  return creature.health < creature.maxHealth * HURT_FRACTION;
}

/**
 * When the creature is hurt, returns a desired velocity towards the nearest
 * visible healing heart, or null if it isn't hurt or none is in range. Mirrors
 * `seekFoodIfHungry` so every behaviour can prioritise patching itself up.
 */
export function seekHealingIfHurt(
  creature: Creature,
  nearby: Entity[],
  world: World,
): Vec2 | null {
  if (!isHurt(creature)) return null;

  let nearestHeart: Heart | null = null;
  let nearestDist = Infinity;
  for (const e of nearby) {
    if (e instanceof Heart && e.isAlive) {
      const d = distance(creature.position, e.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearestHeart = e;
      }
    }
  }
  if (!nearestHeart) return null;

  creature.lastActivity = "Hurt, seeking a heart";
  return creature.nav.seek(creature, nearestHeart.position, world);
}

/**
 * When the creature is hungry, returns a desired velocity towards the nearest
 * visible food, or null if it isn't hungry or no food is in range. Every
 * behaviour can call this so survival takes priority over its usual drive.
 */
export function seekFoodIfHungry(
  creature: Creature,
  nearby: Entity[],
  world: World,
): Vec2 | null {
  if (!isHungry(creature)) return null;

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
  if (!nearestFood) return null;

  creature.lastActivity = "Hungry, seeking food";
  return creature.nav.seek(creature, nearestFood.position, world);
}

/**
 * Accumulated "run away" force from any incoming fireballs in range. Creatures
 * read a fireball as a hostile, fast-moving threat and scramble away from it.
 * The push is weighted heavier than a creature threat (×1.6) so dodging a
 * projectile takes priority. Fireballs from the creature's own faction can't
 * hurt it, so it ignores those. Returns a zero vector when nothing's incoming.
 */
export function fireballDodgeForce(creature: Creature, nearby: Entity[]): Vec2 {
  let force = vec(0, 0);
  for (const e of nearby) {
    if (!(e instanceof Fireball) || !e.isAlive) continue;
    if (e.faction !== "" && e.faction === creature.faction) continue; // harmless to us
    const d = distance(creature.position, e.position);
    if (d < FIREBALL_DODGE_RADIUS && d > 0) {
      const away = normalize(sub(creature.position, e.position));
      const urgency = 1 - d / FIREBALL_DODGE_RADIUS;
      force = add(force, scale(away, urgency * 1.6));
    }
  }
  return force;
}

/**
 * Shared survival instinct used by otherwise-passive behaviours (curious, grazer).
 * Flees creatures that can deal damage, then seeks food when hungry.
 * Returns a desired velocity when survival should override normal behaviour,
 * or null to let the caller carry on as usual.
 */
export function survivalDrive(
  creature: Creature,
  nearby: Entity[],
  world: World,
): Vec2 | null {
  // 1. Flee from anything that can hurt us (predators / aggressors deal collision
  //    damage) and dodge any incoming fireballs.
  let fleeForce = vec(0, 0);
  let threats = 0;
  for (const e of nearby) {
    if (e === creature || !e.isAlive) continue;
    if (!("species" in e)) continue; // only creatures are dangerous
    const other = e as Creature;
    if (other.damage <= 0) continue; // harmless, ignore
    if (creature.alliedWith(other)) continue; // never fear a faction ally
    const d = distance(creature.position, other.position);
    if (d < THREAT_RADIUS && d > 0) {
      const away = normalize(sub(creature.position, other.position));
      const urgency = 1 - d / THREAT_RADIUS;
      fleeForce = add(fleeForce, scale(away, urgency));
      threats++;
    }
  }
  const dodge = fireballDodgeForce(creature, nearby);
  if (dodge.x !== 0 || dodge.y !== 0) {
    fleeForce = add(fleeForce, dodge);
    threats++;
  }
  if (threats > 0) {
    creature.lastActivity = `Fleeing (${threats} nearby)`;
    return creature.nav.flee(creature, fleeForce, world);
  }

  // 2. If we're wounded, go patch up at the nearest heart.
  const healing = seekHealingIfHurt(creature, nearby, world);
  if (healing) return healing;

  // 3. If we're running low on energy, prioritise finding food over sightseeing.
  return seekFoodIfHungry(creature, nearby, world);
}
