import { Vec2, vec, sub, normalize, scale, distance } from "../utils/vec2";
import type { Behaviour } from "./behaviour";
import type { Creature } from "../entities/creature";
import type { Entity, World } from "../entities/entity";
import { LaserBeam, LASER_LENGTH } from "../entities/laser";
import { Shockwave } from "../entities/shockwave";
import {
  createDeathShardling,
  VOID_FACTION,
} from "../entities/creatures/registry";

/** Seconds between laser sweeps. */
const LASER_COOLDOWN = 3.2;
/** Seconds between knock-back shockwaves. */
const SHOCKWAVE_COOLDOWN = 5;

/** Standoff distance the Shard tries to hold from its prey (within laser reach). */
const KEEP_RANGE = 380;
/** Slack around KEEP_RANGE before the boss bothers closing or backing off. */
const RANGE_SLACK = 70;

// Stage-2 summoning tuning (kicks in once the core is at half health).
const SPAWN_MIN_INTERVAL = 0.6; // seconds
const SPAWN_MAX_INTERVAL = 1.2;
const MAX_MINIONS = 40; // living shardlings the boss will sustain at once

/**
 * The Shard of Death. A towering crystal sheathed in three concentric crusts
 * that soak every hit before its core takes a scratch. It has no melee bite —
 * it fights at range, raking the swarm with a bright red laser fired from its
 * pointed front and slamming out a knock-back shockwave that hurls aside anything
 * caught behind it. It hovers at a standoff distance, slowly turning to keep its
 * prey in front. Once its core drops to half it enters a second stage, seeding
 * the arena with loyal Death Shardlings. Being infinite-energy, it never tires.
 */
export class ShardBossBehaviour implements Behaviour {
  readonly name = "Shard";
  private wanderAngle = Math.random() * Math.PI * 2;
  private nextLaserTime = 0;
  private nextShockwaveTime = 0;
  private nextSpawnTime = 0;

  decide(creature: Creature, nearby: Entity[], world: World): Vec2 {
    const target = this.nearestEnemy(creature, nearby);

    // Second stage: at half core health and below, keep seeding shardlings.
    const enraged = creature.health <= creature.maxHealth * 0.5;
    if (enraged) this.maybeSummon(creature, world);

    if (target) {
      const dir = normalize(sub(target.position, creature.position));
      const d = distance(creature.position, target.position);
      const angle = Math.atan2(dir.y, dir.x);

      // Laser: rake the prey when it's within beam reach and we're off cooldown.
      if (world.time >= this.nextLaserTime && d <= LASER_LENGTH) {
        world.spawn(new LaserBeam(creature, angle, creature.faction));
        this.nextLaserTime = world.time + LASER_COOLDOWN;
      }

      // Shockwave: slam outward through the rear hemisphere on its own cadence,
      // clearing anything trying to flank or pile in behind the crystal.
      if (world.time >= this.nextShockwaveTime) {
        world.spawn(new Shockwave(creature, angle + Math.PI, creature.faction));
        this.nextShockwaveTime = world.time + SHOCKWAVE_COOLDOWN;
      }

      creature.lastActivity = enraged
        ? `Enraged — searing ${target.species}`
        : `Searing ${target.species}`;

      // Hold a standoff so the prey stays in front and in laser range: close in
      // when too far, drift back when too close, otherwise creep forward just
      // enough to keep the crystal pointed at it.
      if (d > KEEP_RANGE + RANGE_SLACK) {
        return creature.nav.seek(creature, target.position, world);
      }
      if (d < KEEP_RANGE - RANGE_SLACK) {
        return scale(dir, -creature.maxSpeed); // back away, still facing prey
      }
      return scale(dir, creature.maxSpeed * 0.15); // hover, keep facing
    }

    // Nothing to fight: drift slowly.
    creature.lastActivity = enraged ? "Enraged — drifting" : "Drifting";
    this.wanderAngle += (Math.random() - 0.5) * 0.4;
    return vec(
      Math.cos(this.wanderAngle) * creature.maxSpeed * 0.4,
      Math.sin(this.wanderAngle) * creature.maxSpeed * 0.4,
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

  /** Stage-2 summoning: spawn a Death Shardling on a randomised cadence, capped. */
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
      // Spawn just outside the boss's body (crusts included) at a random angle.
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
      world.spawn(createDeathShardling(pos));
    }

    this.nextSpawnTime =
      world.time +
      SPAWN_MIN_INTERVAL +
      Math.random() * (SPAWN_MAX_INTERVAL - SPAWN_MIN_INTERVAL);
  }
}
