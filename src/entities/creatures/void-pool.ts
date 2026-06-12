import type { Creature } from "../creature";
import type { Entity, World } from "../entity";

/**
 * Species that share a single global "health pool": the Charger and Catapult
 * bosses. They don't literally hold one health bar — each keeps its own — but a
 * hit on any one of them is partly soaked by the rest of the pool (see
 * `damageCreature`), so the group sinks or swims together.
 */
export const POOLED_SPECIES = new Set(["Charger", "Catapult"]);

/**
 * Fraction of an incoming hit that is shared out across the rest of the pool.
 * The struck boss only keeps `1 - POOL_SHARE` of the damage; the remaining
 * `POOL_SHARE` is refunded to it and instead spread across the other living
 * pooled bosses, proportional to their current health. Total health removed
 * from the group is unchanged — the damage is redistributed, not reduced.
 */
const POOL_SHARE = 0.5;

function isPooled(e: Entity): e is Creature {
  return (
    "species" in e && e.isAlive && POOLED_SPECIES.has((e as Creature).species)
  );
}

/**
 * Apply `amount` damage to `target`. For an ordinary creature this just lowers
 * its health. But when the target is a pooled boss (Charger/Catapult) with at
 * least one living poolmate, a `POOL_SHARE` slice of the hit is taken off the
 * target and instead distributed across the other pooled bosses in proportion
 * to their current health — so damaging one bleeds the whole group a little.
 *
 * Only the target's own death is finalised by its caller; poolmates pushed to
 * zero here are cleaned up on their next update tick (same as energy damage).
 */
export function damageCreature(target: Creature, amount: number, world: World) {
  // Indestructible structures (the Creative Spawner) shrug off every hit. This
  // is the single damage chokepoint, so guarding it here makes them immune to
  // every source — melee, projectiles and boss attacks alike.
  if (target.indestructible) return;

  // Crust shells (the Shard of Death) soak every hit before the core takes any.
  // The outermost living shell absorbs the whole blow; when it shatters the
  // body shrinks by its thickness and the next shell inward is exposed. Overkill
  // on the shattering blow is simply lost — shells have far more HP than any
  // single hit, so the spill-over never matters in practice.
  const outer = target.crusts[0];
  if (amount > 0 && outer) {
    outer.hp -= amount;
    if (outer.hp <= 0) {
      target.radius -= outer.thickness;
      target.crusts.shift();
    }
    return;
  }

  if (amount <= 0 || !POOLED_SPECIES.has(target.species)) {
    target.health -= amount;
    return;
  }

  const poolmates = world.entities.filter(
    (e): e is Creature => e !== target && isPooled(e),
  );

  const totalHealth = poolmates.reduce((s, p) => s + Math.max(0, p.health), 0);
  if (poolmates.length === 0 || totalHealth <= 0) {
    target.health -= amount; // nobody to share with — take it all
    return;
  }

  const shared = amount * POOL_SHARE;
  target.health -= amount - shared; // keep only our own slice of the hit
  for (const p of poolmates) {
    p.health -= shared * (Math.max(0, p.health) / totalHealth);
  }
}
