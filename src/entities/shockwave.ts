import { add, distance, normalize, scale, sub, vec, Vec2 } from "../utils/vec2";
import { Entity, generateId, World } from "./entity";
import { Creature } from "./creature";
import { damageCreature } from "./creatures/void-pool";

/** How far out the wave front races from the boss before it dissipates. */
export const SHOCKWAVE_MAX_RADIUS = 540;
/** Outward speed of the expanding front, in px/sec. */
export const SHOCKWAVE_SPEED = 920;
/** One-off damage dealt to a creature the front sweeps over. */
export const SHOCKWAVE_DAMAGE = 45;
/** Instant outward shove (px) applied as the front passes a creature. */
export const SHOCKWAVE_PUSH = 64;
/** Outward velocity (px/sec) added on top of the shove, so the knockback carries. */
export const SHOCKWAVE_IMPULSE = 360;

/**
 * A knock-back shockwave the Shard of Death slams out behind itself. The front
 * races outward through the boss's *rear* hemisphere only — creatures in front
 * (where the laser does its work) are untouched. As the front sweeps over a
 * creature it gets a single hit of {@link SHOCKWAVE_DAMAGE} and a hard outward
 * shove away from the boss. Loyal allies (the boss's own minions) are spared.
 *
 * "Behind" is locked at spawn to `backAngle` (pointing away from the boss's
 * target), and each creature is caught at most once — the tick the front crosses
 * its centre — by comparing the front's radius this frame against last frame.
 */
export class Shockwave implements Entity {
  id: number;
  isAlive = true;
  radius = 0; // current front radius; grows each tick
  spawnTime: number;
  position: Vec2;
  /** Front radius on the previous tick, so each creature is caught exactly once. */
  private prevRadius = 0;

  constructor(
    /** The boss the wave emanates from; dies with it. */
    private owner: Creature,
    /** Heading of the rear hemisphere (away from the boss's target), in radians. */
    public backAngle: number,
    public faction: string,
  ) {
    this.id = generateId();
    this.position = { ...owner.position };
    this.radius = owner.coreRadius;
    this.prevRadius = owner.coreRadius;
    this.spawnTime = performance.now();
  }

  /** 0→1 expansion progress, for the renderer to fade the ring as it spends. */
  get progress(): number {
    return Math.min(1, this.radius / SHOCKWAVE_MAX_RADIUS);
  }

  update(dt: number, world: World) {
    if (!this.isAlive) return;
    if (!this.owner.isAlive) {
      this.isAlive = false;
      return;
    }

    this.position = { ...this.owner.position };
    this.prevRadius = this.radius;
    this.radius += SHOCKWAVE_SPEED * dt;
    if (this.radius >= SHOCKWAVE_MAX_RADIUS) this.isAlive = false;

    const back = vec(Math.cos(this.backAngle), Math.sin(this.backAngle));

    for (const e of world.getNearby(this.position, this.radius + 60)) {
      if (!(e instanceof Creature) || !e.isAlive || e === this.owner) continue;
      if (this.faction !== "" && e.faction === this.faction) continue; // ally
      if (e.isShielded) continue;

      const rel = sub(e.position, this.position);
      // Only the rear hemisphere is hit: the creature must lie behind the boss.
      if (rel.x * back.x + rel.y * back.y <= 0) continue;

      // Catch it the single tick the front sweeps across its centre.
      const d = distance(this.position, e.position);
      if (d <= this.prevRadius || d > this.radius) continue;

      const out = normalize(rel);
      if (out.x !== 0 || out.y !== 0) {
        e.position = add(e.position, scale(out, SHOCKWAVE_PUSH));
        e.velocity = add(e.velocity, scale(out, SHOCKWAVE_IMPULSE));
      }

      const wasAlive = e.health > 0;
      damageCreature(e, SHOCKWAVE_DAMAGE, world);
      e.provoke();
      if (wasAlive && e.health <= 0) {
        e.health = 0;
        e.isAlive = false;
        e.deathTime = performance.now();
      }
    }
  }
}
