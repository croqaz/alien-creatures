import { add, distance, normalize, scale, sub, vec, Vec2 } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { Fireball } from "../entities/fireball";
import { Shockwave } from "../entities/shockwave";
import { createVoidSpiker, VOID_FACTION } from "../entities/creatures/registry";

// Ranged attack tuning.
const FIREBALL_DAMAGE = 95;
const FIREBALL_SPEED = 340;
const FIREBALL_RANGE = 780; // won't bother firing past this
const FIREBALL_COOLDOWN = 0.8; // seconds of sim time between shots (stage 1)
const FIREBALL_COOLDOWN_ENRAGED = 0.35; // faster fireballs in stage 2

// Shockwave tuning (stage 2 only, like the Shard of Death).
const SHOCKWAVE_COOLDOWN = 3.5; // seconds between knock-back shockwaves

// Stage-2 summoning tuning (kicks in at half health).
const SPAWN_MIN_INTERVAL = 0.5; // seconds
const SPAWN_MAX_INTERVAL = 1;
const MAX_MINIONS = 50; // alive void spikers the boss will sustain at once

/**
 * The boss. Permanently aggressive: it hunts the nearest creature outside its
 * faction and lobs fireballs at range. Once its health drops to half it enters
 * a second stage, periodically summoning loyal Void Spikers that swarm everyone
 * but the boss and each other. It never flees, never grazes, and (being
 * infinite-energy) never tires.
 *
 * Stage 2 also kicks in faster fireballs (0.35s cooldown instead of 0.8s) and
 * periodic knock-back shockwaves behind the boss that clear flankers — a direct
 * parallel to how the Shard of Death fights, so the Voidspike uses fireballs
 * for its forward arsenal and shockwaves to protect its rear.
 */
export class BossBehaviour implements Behaviour {
  readonly name = "Boss";
  private wanderAngle = Math.random() * Math.PI * 2;
  private nextFireTime = 0;
  private nextShockwaveTime = 0;
  private nextSpawnTime = 0;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    const target = this.nearestEnemy(creature, nearby);

    // Second stage: at half health and below, keep summoning loyal spikers.
    const enraged = creature.health <= creature.maxHealth * 0.5;
    if (enraged) this.maybeSummon(creature, world);

    if (target) {
      const dir = normalize(sub(target.position, creature.position));
      const d = distance(creature.position, target.position);

      // Fire when off cooldown and the target is in range.
      if (world.time >= this.nextFireTime && d <= FIREBALL_RANGE) {
        this.shoot(creature, target, world);
        this.nextFireTime =
          world.time +
          (enraged ? FIREBALL_COOLDOWN_ENRAGED : FIREBALL_COOLDOWN);
      }

      // Stage 2 shockwave: slam a knock-back wave behind the boss on its own
      // cadence, clearing anything trying to flank or pile on from the rear.
      if (enraged && world.time >= this.nextShockwaveTime) {
        const angle = Math.atan2(dir.y, dir.x);
        world.spawn(new Shockwave(creature, angle + Math.PI, creature.faction));
        this.nextShockwaveTime = world.time + SHOCKWAVE_COOLDOWN;
      }

      creature.lastActivity = enraged
        ? `Enraged — hunting ${target.species}`
        : `Hunting ${target.species}`;
      return creature.nav.seek(creature, target.position, world);
    }

    // Nothing to fight: prowl slowly.
    creature.lastActivity = enraged ? "Enraged — prowling" : "Prowling";
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

  /** Lob a fireball from the boss's rim toward `target`. */
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

  /** Stage-2 summoning: spawn a Void Spiker on a randomised cadence, capped. */
  private maybeSummon(creature: Creature, world: World) {
    if (world.time < this.nextSpawnTime) {
      // First time enraged, schedule the opening summon shortly after.
      if (this.nextSpawnTime === 0) this.nextSpawnTime = world.time + 1;
      return;
    }

    const minions = world.entities.filter(
      (e) =>
        e.isAlive &&
        "faction" in e &&
        (e as Creature).faction === VOID_FACTION &&
        e !== creature,
    ).length;

    if (minions < MAX_MINIONS) {
      // Spawn just outside the boss's body at a random angle.
      const a = Math.random() * Math.PI * 2;
      const off = creature.radius + 30;
      let pos = {
        x: creature.position.x + Math.cos(a) * off,
        y: creature.position.y + Math.sin(a) * off,
      };
      pos = {
        x: Math.max(20, Math.min(world.arenaWidth - 20, pos.x)),
        y: Math.max(20, Math.min(world.arenaHeight - 20, pos.y)),
      };
      world.spawn(createVoidSpiker(pos));
    }

    this.nextSpawnTime =
      world.time +
      SPAWN_MIN_INTERVAL +
      Math.random() * (SPAWN_MAX_INTERVAL - SPAWN_MIN_INTERVAL);
  }
}
