import { add, scale, sub, vec, Vec2 } from "../utils/vec2";
import { Entity, generateId, World } from "./entity";
import { Creature } from "./creature";
import { damageCreature } from "./creatures/void-pool";

/** Length the beam reaches forward from the boss's front edge. */
export const LASER_LENGTH = 760;
/** Half-width of the damaging beam — a creature within this of the axis is hit. */
export const LASER_HALF_WIDTH = 26;
/** Damage per second dealt to anything bathed in the active beam. */
export const LASER_DPS = 130;
/** Seconds the beam telegraphs (thin, harmless) before it fires. */
export const LASER_CHARGE = 0.6;
/** Seconds the beam burns at full strength after charging. */
export const LASER_ACTIVE = 0.9;

/**
 * A bright red laser the Shard of Death fires from its pointed front. Unlike a
 * fireball it isn't a travelling projectile: it's a beam anchored to the boss,
 * locked to the heading it was fired along, that lingers for a fixed window. It
 * first charges (a thin telegraph that deals no damage) so the swarm has a beat
 * to scatter, then burns at full strength, raking every non-allied creature that
 * stands in its path for {@link LASER_DPS} per second. Loyal allies (same
 * faction — the boss's own minions) are never touched.
 */
export class LaserBeam implements Entity {
  id: number;
  isAlive = true;
  radius = 0; // not a physical body; present only to satisfy Entity
  spawnTime: number;
  /** Beam origin (the boss's front edge) — also the entity's nominal position. */
  position: Vec2;
  /** Seconds of sim time elapsed since the beam was fired. */
  private age = 0;

  constructor(
    /** The boss the beam stays anchored to; the beam dies if it dies. */
    private owner: Creature,
    /** Locked heading the beam points along, in radians. */
    public angle: number,
    public faction: string,
  ) {
    this.id = generateId();
    this.position = { ...owner.position };
    this.spawnTime = performance.now();
  }

  /** True once the telegraph is over and the beam is actually burning. */
  get isFiring(): boolean {
    return this.age >= LASER_CHARGE;
  }

  /** 0→1 charge progress while telegraphing, then pinned at 1. */
  get charge(): number {
    return Math.min(1, this.age / LASER_CHARGE);
  }

  update(dt: number, world: World) {
    if (!this.isAlive) return;
    if (!this.owner.isAlive) {
      this.isAlive = false;
      return;
    }

    this.age += dt;
    if (this.age >= LASER_CHARGE + LASER_ACTIVE) {
      this.isAlive = false;
      return;
    }

    // Re-anchor to the boss's front edge each tick so the beam tracks its body
    // (the heading itself stays locked — the boss can't sweep it around).
    const dir = vec(Math.cos(this.angle), Math.sin(this.angle));
    this.position = add(this.owner.position, scale(dir, this.owner.coreRadius));

    if (!this.isFiring) return; // still telegraphing — no damage yet

    // Rake every non-allied creature whose body overlaps the beam rectangle.
    // Query from the beam origin so the search reaches the full beam length.
    for (const e of world.getNearby(this.position, LASER_LENGTH + 60)) {
      if (!(e instanceof Creature) || !e.isAlive || e === this.owner) continue;
      if (this.faction !== "" && e.faction === this.faction) continue; // ally
      if (e.isShielded) continue; // a shielded creature shrugs the beam off

      const rel = sub(e.position, this.position);
      const along = rel.x * dir.x + rel.y * dir.y; // distance down the beam
      if (along < -e.radius || along > LASER_LENGTH + e.radius) continue;
      const perp = rel.x * -dir.y + rel.y * dir.x; // signed offset from axis
      if (Math.abs(perp) > LASER_HALF_WIDTH + e.radius) continue;

      const wasAlive = e.health > 0;
      damageCreature(e, LASER_DPS * dt, world); // shared-pool aware
      e.provoke();
      if (wasAlive && e.health <= 0) {
        e.health = 0;
        e.isAlive = false;
        e.deathTime = performance.now();
      }
    }
  }
}
