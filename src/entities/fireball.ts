import { Vec2, add, scale, distance, magnitude } from "../utils/vec2";
import { Entity, World, generateId } from "./entity";
import { Creature } from "./creature";
import { damageCreature } from "./creatures/void-pool";

/** Fraction of the map's larger dimension a fireball flies before fizzling out. */
const RANGE_FRACTION = 1 / 3;

/**
 * A travelling projectile lobbed by a ranged attacker (currently only the boss).
 * It flies in a straight line and deals its `damage` as a single burst to the
 * first non-allied creature it touches, then dies. Walls, the arena edge, and
 * its travel range all stop it — it fizzles after covering a third of the map.
 * Allies of the firer (same `faction`) and the firer itself are ignored, so the
 * boss never roasts its own spikers.
 */
export class Fireball implements Entity {
  id: number;
  isAlive = true;
  radius = 13;
  spawnTime: number;
  /** Distance covered so far; the fireball dies once it exceeds its range. */
  private traveled = 0;

  constructor(
    public position: Vec2,
    public velocity: Vec2,
    public damage: number,
    /** Faction of the firer; creatures sharing it are immune to this fireball. */
    public faction: string,
    /** Id of the firer, so it can't hit itself point-blank. */
    public ownerId: number,
  ) {
    this.id = generateId();
    this.spawnTime = performance.now();
  }

  update(dt: number, world: World) {
    if (!this.isAlive) return;

    // Fizzle once it has flown a third of the map's larger dimension.
    const maxRange =
      Math.max(world.arenaWidth, world.arenaHeight) * RANGE_FRACTION;
    const step = scale(this.velocity, dt);
    this.traveled += magnitude(step);
    if (this.traveled >= maxRange) {
      this.isAlive = false;
      return;
    }

    this.position = add(this.position, step);

    // Fizzle against walls or once it leaves the arena.
    if (
      this.position.x < 0 ||
      this.position.y < 0 ||
      this.position.x > world.arenaWidth ||
      this.position.y > world.arenaHeight ||
      world.walls.overlaps(this.position, this.radius)
    ) {
      this.isAlive = false;
      return;
    }

    // Detonate on the first enemy creature it overlaps.
    for (const e of world.getNearby(this.position, this.radius + 40)) {
      if (!(e instanceof Creature) || !e.isAlive) continue;
      if (e.id === this.ownerId) continue;
      if (this.faction !== "" && e.faction === this.faction) continue; // ally
      if (e.isShielded) continue; // shrugged off entirely
      if (distance(this.position, e.position) > this.radius + e.radius)
        continue;

      const wasAlive = e.health > 0;
      damageCreature(e, this.damage, world); // shared-pool aware
      e.provoke(); // a struck defender fights back, same as a melee hit
      if (wasAlive && e.health <= 0) {
        e.health = 0;
        e.isAlive = false;
        e.deathTime = performance.now();
      }
      this.isAlive = false;
      return;
    }
  }
}
