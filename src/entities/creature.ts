import {
  Vec2,
  vec,
  add,
  scale,
  limit,
  distance,
  sub,
  normalize,
  lerp,
} from "../utils/vec2";
import { Entity, World, generateId } from "./entity";
import { Food } from "./food";
import { Heart } from "./heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "./powerup";
import type { Behaviour } from "../behaviours/behaviour";
import { Navigator } from "../behaviours/navigator";
import { damageCreature } from "./creatures/void-pool";
import { Arrow, ARROW_DAMAGE, ARROW_SPEED, ARCHER_COOLDOWN } from "./arrow";

export type ShapeType =
  | "circle"
  | "oval"
  | "triangle"
  | "rounded-rect"
  | "spiked"
  | "pentagon";

/** How long (ms) a provoked defender stays hostile after the last hit it takes. */
const RETALIATION_MS = 2000;

/**
 * How much an Elite creature multiplies its base combat stats. Elites are rare
 * (see the spawn roll in the panel), share their species' behaviour, and only
 * differ by these juiced stats and the red pulsating aura the renderer draws.
 */
export const ELITE_STAT_MULTIPLIER = 10;

export interface CreatureConfig {
  species: string;
  color: string;
  accentColor: string;
  shape: ShapeType;
  radius: number;
  maxSpeed: number;
  maxHealth: number;
  maxEnergy: number;
  damage: number;
  /**
   * Contact damage dealt only while provoked (a peaceful creature struck by
   * something hostile fights back). 0/undefined means it never retaliates.
   */
  retaliation?: number;
  perceptionRadius: number;
  behaviour: Behaviour;
  /**
   * Allegiance group. Creatures sharing a non-empty faction are loyal to one
   * another — they never deal contact damage to allies and won't hunt them.
   * The default empty string means "no allegiance": every creature is a
   * potential enemy (so e.g. two Spikers still fight each other).
   */
  faction?: string;
  /**
   * When true the creature never spends energy and never starves. Its energy
   * stays pinned at full. Used by the boss, the first creature to have it.
   */
  infiniteEnergy?: boolean;
  /** When false the creature passes straight through food (can't eat). Defaults true. */
  canEatFood?: boolean;
  /** When false the creature ignores all power-ups. Defaults true. */
  canPickupPowerups?: boolean;
}

export class Creature implements Entity {
  id: number;
  position: Vec2;
  velocity: Vec2 = vec(0, 0);
  isAlive = true;

  species: string;
  color: string;
  accentColor: string;
  shape: ShapeType;
  radius: number;
  /** Base top speed before any power-up boosts. `maxSpeed` applies the multiplier. */
  baseMaxSpeed: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  damage: number;
  retaliation: number;
  perceptionRadius: number;
  behaviour: Behaviour;
  faction: string;
  infiniteEnergy: boolean;
  canEatFood: boolean;
  canPickupPowerups: boolean;

  /**
   * An Elite is a rare, super-charged variant of an ordinary creature: same
   * behaviour, but ELITE_STAT_MULTIPLIER× the combat stats and a red pulsating
   * aura. Set by makeElite() right after construction. Bosses and boss minions
   * are never elite (the spawner refuses to promote them).
   */
  isElite = false;

  /**
   * An Archer is a rare variant that, on top of its normal behaviour, looses
   * arrows at the nearest enemy whenever it's in fighting mode (see
   * `maybeFireArrow`). Set by makeArcher() right after construction. A creature
   * is at most one of Elite or Archer, and only fighters ever become archers.
   */
  isArcher = false;

  /** Sim-time (`world.time`) at which an Archer may loose its next arrow. */
  private nextArrowTime = 0;

  /**
   * Timestamp (performance.now) until which a retaliating creature stays
   * hostile. While provoked its `attackDamage` is its `retaliation` value.
   */
  private provokedUntil = 0;

  /** Timestamp (performance.now) until which a shield power-up keeps this creature indestructible. */
  private shieldedUntil = 0;

  /** Timestamp (performance.now) until which a speed power-up is active, and its multiplier. */
  private spedUpUntil = 0;
  private speedBoost = 1;

  /** Timestamp (performance.now) until which a sword power-up is active, and its damage multiplier. */
  private armedUntil = 0;
  private swordFactor = 1;

  /** Wall-aware navigation, used by behaviours that move toward or away from a target. */
  nav = new Navigator();

  /**
   * The point the creature is actively trying to reach this tick (set by the
   * Navigator when seeking food/prey). Wall avoidance uses it to stand down on
   * the final approach so a target tucked against a wall is still reachable.
   * Null when wandering with no concrete destination.
   */
  steerTarget: Vec2 | null = null;

  deathTime = 0;
  spawnTime: number;
  lastActivity = "Idle";

  constructor(position: Vec2, config: CreatureConfig) {
    this.id = generateId();
    this.position = { ...position };
    this.species = config.species;
    this.color = config.color;
    this.accentColor = config.accentColor;
    this.shape = config.shape;
    this.radius = config.radius;
    this.baseMaxSpeed = config.maxSpeed;
    this.health = config.maxHealth;
    this.maxHealth = config.maxHealth;
    this.energy = config.maxEnergy;
    this.maxEnergy = config.maxEnergy;
    this.damage = config.damage;
    this.retaliation = config.retaliation ?? 0;
    this.perceptionRadius = config.perceptionRadius;
    this.behaviour = config.behaviour;
    this.faction = config.faction ?? "";
    this.infiniteEnergy = config.infiniteEnergy ?? false;
    this.canEatFood = config.canEatFood ?? true;
    this.canPickupPowerups = config.canPickupPowerups ?? true;
    this.spawnTime = performance.now();
  }

  /**
   * Promote this creature to an Elite: ELITE_STAT_MULTIPLIER× its combat stats
   * (health, energy, damage, retaliation) while keeping its behaviour, size and
   * speed unchanged — physics and movement stay sane, and the red aura the
   * renderer adds is what marks it out. Call once, right after construction and
   * before the creature has taken any damage (health/energy are reset to the new
   * maxima). Returns `this` for convenient chaining at the spawn site.
   */
  makeElite(): this {
    this.isElite = true;
    this.maxHealth *= ELITE_STAT_MULTIPLIER;
    this.health = this.maxHealth;
    this.maxEnergy *= ELITE_STAT_MULTIPLIER;
    this.energy = this.maxEnergy;
    this.damage *= ELITE_STAT_MULTIPLIER;
    this.retaliation *= ELITE_STAT_MULTIPLIER;
    return this;
  }

  /**
   * Promote this creature to an Archer: it keeps its stats and behaviour but
   * gains a bow, loosing arrows at nearby enemies while it's in fighting mode
   * (see `maybeFireArrow`). Returns `this` for chaining at the spawn site.
   */
  makeArcher(): this {
    this.isArcher = true;
    return this;
  }

  /**
   * True if `other` is a loyal ally: both share the same non-empty faction.
   * Allies never damage one another and won't hunt each other. An empty
   * faction means "no allegiance", so it's allied with nobody (not even other
   * factionless creatures) — preserving every-creature-for-itself by default.
   */
  alliedWith(other: Creature): boolean {
    return this.faction !== "" && this.faction === other.faction;
  }

  /** True while a retaliating creature is still fighting back after a hit. */
  get isProvoked(): boolean {
    return this.retaliation > 0 && performance.now() < this.provokedUntil;
  }

  /**
   * Mark this creature as struck by something hostile. A retaliating species
   * (retaliation > 0) fights back for the next RETALIATION_MS; harmless species
   * ignore it. Called by the attacker when it lands a hit, so provocation is
   * independent of creature update order and the mutual collision push-apart.
   */
  provoke() {
    if (this.retaliation > 0) {
      this.provokedUntil = performance.now() + RETALIATION_MS;
    }
  }

  /**
   * Contact damage this creature actually deals right now. Normally `damage`,
   * but a provoked defender deals its `retaliation` value instead. This single
   * value drives all combat: >0 deals damage and heals on a kill (predator-like),
   * <=0 heals from plant food (herbivore-like).
   */
  get attackDamage(): number {
    const base = this.isProvoked ? this.retaliation : this.damage;
    return this.isArmed ? base * this.swordFactor : base;
  }

  /** True while a sword power-up is boosting this creature's contact damage. */
  get isArmed(): boolean {
    return performance.now() < this.armedUntil;
  }

  /** Only fighters (predators/aggressors/retaliators) can wield a sword. */
  get canWieldSword(): boolean {
    return this.damage > 0 || this.retaliation > 0;
  }

  /** Grant (or refresh) a sword boost of `multiplier`× damage for `durationMs`. */
  applySword(multiplier: number, durationMs: number) {
    this.swordFactor = multiplier;
    this.armedUntil = performance.now() + durationMs;
  }

  /** True while a shield power-up is active: takes no damage and drains no energy. */
  get isShielded(): boolean {
    return performance.now() < this.shieldedUntil;
  }

  /** Grant (or refresh) a shield lasting `durationMs`. */
  applyShield(durationMs: number) {
    this.shieldedUntil = performance.now() + durationMs;
  }

  /** True while a speed power-up is active. */
  get isSpedUp(): boolean {
    return performance.now() < this.spedUpUntil;
  }

  /**
   * Effective top speed: the base speed scaled by an active speed power-up.
   * Everything that moves the creature (behaviours, navigator, the velocity
   * limit) reads this, so the boost applies uniformly.
   */
  get maxSpeed(): number {
    return this.isSpedUp
      ? this.baseMaxSpeed * this.speedBoost
      : this.baseMaxSpeed;
  }

  /** Grant (or refresh) a speed boost of `multiplier`× for `durationMs`. */
  applySpeed(multiplier: number, durationMs: number) {
    this.speedBoost = multiplier;
    this.spedUpUntil = performance.now() + durationMs;
  }

  update(dt: number, world: World) {
    if (!this.isAlive) return;

    const nearby = world.getNearby(this.position, this.perceptionRadius);

    // An archer looses arrows at enemies on top of whatever it's doing.
    if (this.isArcher) this.maybeFireArrow(nearby, world);

    this.steerTarget = null; // behaviours set this via the navigator if they seek
    // Combat reflexes override the base behaviour, in priority order:
    //   1. retaliate — a provoked creature charges whoever just hit it;
    //   2. assist — a faction fighter rushes to help an ally under attack.
    // Both fall through to the creature's normal behaviour when neither applies.
    const desired =
      this.retaliationDrive(nearby, world) ??
      this.assistAllyDrive(nearby, world) ??
      this.behaviour.decide(this, nearby, world);
    const steered = this.avoidWalls(desired, world);
    this.velocity = limit(
      lerp(this.velocity, steered, Math.min(1, dt * 8)),
      this.maxSpeed,
    );
    this.position = add(this.position, scale(this.velocity, dt));

    // Clamp to arena
    const margin = this.radius;
    if (this.position.x < margin) {
      this.position.x = margin;
      this.velocity.x *= -0.5;
    }
    if (this.position.x > world.arenaWidth - margin) {
      this.position.x = world.arenaWidth - margin;
      this.velocity.x *= -0.5;
    }
    if (this.position.y < margin) {
      this.position.y = margin;
      this.velocity.y *= -0.5;
    }
    if (this.position.y > world.arenaHeight - margin) {
      this.position.y = world.arenaHeight - margin;
      this.velocity.y *= -0.5;
    }

    // Block movement through walls: eject from any overlapped tile and cancel
    // the velocity component pushing into it (so creatures slide along walls).
    const resolved = world.walls.resolveCircle(this.position, this.radius);
    if (resolved.x !== this.position.x || resolved.y !== this.position.y) {
      const nx = resolved.x - this.position.x;
      const ny = resolved.y - this.position.y;
      const nlen = Math.sqrt(nx * nx + ny * ny);
      if (nlen > 0) {
        const ux = nx / nlen;
        const uy = ny / nlen;
        const vDotN = this.velocity.x * ux + this.velocity.y * uy;
        if (vDotN < 0) {
          this.velocity.x -= vDotN * ux;
          this.velocity.y -= vDotN * uy;
        }
      }
      this.position = resolved;
    }

    // Energy drain (a shielded creature is sustained — no drain, no starvation;
    // an infinite-energy creature never spends or starves either).
    if (!this.isShielded && !this.infiniteEnergy) {
      this.energy -= dt * 0.4;
      if (this.energy <= 0) {
        this.energy = 0;
        this.health -= dt * 10;
      }
    }

    // Interactions with nearby entities
    for (const e of nearby) {
      if (e === this || !e.isAlive) continue;
      const d = distance(this.position, e.position);

      // Eat food (some creatures, like the boss, can't feed and pass through it)
      if (e instanceof Food && this.canEatFood && d < this.radius + e.radius) {
        e.isAlive = false;
        this.energy = Math.min(this.maxEnergy, this.energy + e.nutrition);
        // Carnivores (attackDamage > 0) draw only energy from plant food — no
        // healing. Herbivores also heal from it. A provoked defender feeds like
        // a carnivore for the moment, so it only heals from kills, not grazing.
        if (this.attackDamage <= 0) {
          this.health = Math.min(this.maxHealth, this.health + e.nutrition);
        }
      }

      // Touch a heart to heal (every creature benefits, carnivore or not)
      if (e instanceof Heart && d < this.radius + e.radius) {
        e.isAlive = false;
        this.health = Math.min(this.maxHealth, this.health + e.healing);
      }

      // Grab a shield power-up to become indestructible for a while.
      if (
        e instanceof ShieldPowerup &&
        this.canPickupPowerups &&
        d < this.radius + e.radius
      ) {
        e.isAlive = false;
        this.applyShield(e.duration);
      }

      // Grab a speed power-up to move faster for a while.
      if (
        e instanceof SpeedPowerup &&
        this.canPickupPowerups &&
        d < this.radius + e.radius
      ) {
        e.isAlive = false;
        this.applySpeed(e.multiplier, e.duration);
      }

      // Grab a sword power-up for boosted damage — but only fighters can wield
      // one; everyone else passes straight through it (and some, like the boss,
      // can't pick up any power-up at all).
      if (
        e instanceof SwordPowerup &&
        this.canPickupPowerups &&
        this.canWieldSword &&
        d < this.radius + e.radius
      ) {
        e.isAlive = false;
        this.applySword(e.multiplier, e.duration);
      }

      // Creature collision
      if (e instanceof Creature && d < this.radius + e.radius && d > 0) {
        // Push apart
        const pushDir = normalize(sub(this.position, e.position));
        const overlap = (this.radius + e.radius - d) * 0.5;
        this.position = add(this.position, scale(pushDir, overlap));
        e.position = add(e.position, scale(pushDir, -overlap));

        // Damage if aggressive/predator (or a provoked defender fighting back).
        // A shielded target shrugs it off entirely — no damage, no retaliation
        // trigger. Loyal allies (same faction) never hurt each other, so the
        // boss and its spawned spikers can pile together harmlessly.
        if (this.attackDamage > 0 && !e.isShielded && !this.alliedWith(e)) {
          const wasAlive = e.health > 0;
          damageCreature(e, this.attackDamage * dt, world); // shared-pool aware
          // Whatever we just hit fights back if it's a retaliating species.
          // Done from the attacker's side so it's immune to update order and
          // the push-apart above (which can separate us before the victim runs
          // its own collision check).
          e.provoke();
          // Landing the killing blow lets a carnivore feed on the prey,
          // healing it 4x what a normal piece of food (25) would. Creatures
          // that can't eat (the boss) gain nothing from a kill — they heal only
          // from hearts, so they aren't effectively indestructible.
          if (wasAlive && e.health <= 0 && this.canEatFood) {
            this.health = Math.min(this.maxHealth, this.health + 100);
          }
        }
      }
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.deathTime = performance.now();
    }
  }

  /**
   * Archer attack: on a fixed cooldown, loose an arrow at the nearest non-allied
   * creature in perception. Gated on `attackDamage > 0`, so a permanently
   * aggressive species fires whenever an enemy is in sight, while a retaliator
   * (e.g. a Defender) only shoots while provoked — exactly when it would melee.
   * Shielded targets are skipped (arrows are shrugged off, same as fireballs).
   */
  private maybeFireArrow(nearby: Entity[], world: World) {
    if (this.attackDamage <= 0) return;
    if (world.time < this.nextArrowTime) return;

    let target: Creature | null = null;
    let best = Infinity;
    for (const e of nearby) {
      if (e === this || !e.isAlive || !(e instanceof Creature)) continue;
      if (this.alliedWith(e) || e.isShielded) continue;
      const d = distance(this.position, e.position);
      if (d < best) {
        best = d;
        target = e;
      }
    }
    if (!target) return;

    const dir = normalize(sub(target.position, this.position));
    if (dir.x === 0 && dir.y === 0) return;
    const origin = add(this.position, scale(dir, this.radius + 6));
    world.spawn(
      new Arrow(
        origin,
        scale(dir, ARROW_SPEED),
        ARROW_DAMAGE,
        this.faction,
        this.id,
      ),
    );
    this.nextArrowTime = world.time + ARCHER_COOLDOWN;
  }

  /**
   * Universal "fight back when struck" drive. A creature with retaliation > 0
   * that has been provoked (hit recently) charges its nearest dangerous,
   * non-allied attacker — exactly how the Defender behaves, but available to
   * every species (e.g. a Crawler with retaliation set). Returns steering
   * toward that attacker, or null when the creature isn't currently retaliating
   * so its normal behaviour takes over.
   */
  private retaliationDrive(nearby: Entity[], world: World): Vec2 | null {
    if (!this.isProvoked) return null; // isProvoked already implies retaliation > 0

    let threat: Creature | null = null;
    let threatDist = Infinity;
    for (const e of nearby) {
      if (e === this || !e.isAlive) continue;
      if (!(e instanceof Creature)) continue;
      if (e.damage <= 0) continue; // only genuinely dangerous attackers
      if (this.alliedWith(e)) continue; // never turn on a loyal ally
      const d = distance(this.position, e.position);
      if (d < threatDist) {
        threatDist = d;
        threat = e;
      }
    }

    if (!threat) return null;
    this.lastActivity = `Fighting back against ${threat.species}`;
    return this.nav.seek(this, threat.position, world);
  }

  /**
   * Faction teamwork: a combat-capable creature charges the nearest enemy that
   * is menacing one of its faction allies, so members come to each other's aid
   * (and defend their own spawner). Returns steering toward that enemy, or null
   * when there's no ally to help. Skipped for the factionless (every creature
   * for itself), for non-fighters (no damage and no retaliation to contribute),
   * and for the boss, which runs its own combat script (fireballs/summons) and
   * shouldn't be pulled off it.
   */
  private assistAllyDrive(nearby: Entity[], world: World): Vec2 | null {
    if (this.faction === "") return null;
    if (this.damage <= 0 && this.retaliation <= 0) return null;
    if (this.infiniteEnergy) return null; // the boss isn't a follower

    let enemy: Creature | null = null;
    let enemyDist = Infinity;
    for (const e of nearby) {
      if (e === this || !e.isAlive || !(e instanceof Creature)) continue;
      if (e.damage <= 0 || this.alliedWith(e)) continue; // not a hostile attacker

      // Only pitch in when this enemy is right on top of one of our allies.
      let menacingAlly = false;
      for (const a of nearby) {
        if (a === this || a === e || !a.isAlive || !(a instanceof Creature)) {
          continue;
        }
        if (!this.alliedWith(a)) continue;
        if (distance(a.position, e.position) < a.radius + e.radius + 30) {
          menacingAlly = true;
          break;
        }
      }
      if (!menacingAlly) continue;

      const d = distance(this.position, e.position);
      if (d < enemyDist) {
        enemyDist = d;
        enemy = e;
      }
    }

    if (!enemy) return null;
    // Arm retaliators (e.g. a Defender) so joining the fight actually lands hits.
    this.provoke();
    this.lastActivity = `Helping against ${enemy.species}`;
    return this.nav.seek(this, enemy.position, world);
  }

  // Remembered turn direction so the creature rounds a wall consistently
  // instead of jittering left/right at the same spot.
  private turnDir = 1;

  /**
   * Simple wall-aware steering: probe ahead along the desired heading and, if a
   * wall blocks the way, rotate the heading until a clear path is found. This
   * lets creatures try a different way around walls rather than grinding into them.
   */
  private avoidWalls(desired: Vec2, world: World): Vec2 {
    if (world.walls.isEmpty()) return desired;
    const speed = Math.hypot(desired.x, desired.y);
    if (speed < 1e-3) return desired;

    const dir = normalize(desired);
    const ahead = this.radius + 28; // look a bit beyond our body

    // On the final approach to a concrete target, don't steer around walls that
    // sit at or behind it — the creature needs to close in (food/prey tucked
    // against a wall) and wall collision resolution will slide it along the
    // surface. Without this, the look-ahead probe keeps hitting the wall behind
    // the target and the creature oscillates left/right, never reaching it.
    if (
      this.steerTarget &&
      distance(this.position, this.steerTarget) <= ahead
    ) {
      return desired;
    }

    if (
      !world.walls.overlaps(add(this.position, scale(dir, ahead)), this.radius)
    ) {
      return desired; // path ahead is clear
    }

    // Blocked: deflect to slide along the wall, preferring the way we last
    // turned. Capped at 90° so we never veer backwards — turning past parallel
    // sends a creature back into open space and makes it ping-pong against a
    // wall that sits between it and its target.
    const baseAngle = Math.atan2(dir.y, dir.x);
    for (const mag of [0.4, 0.8, 1.2, Math.PI / 2]) {
      for (const sign of [this.turnDir, -this.turnDir]) {
        const a = baseAngle + sign * mag;
        const tryDir = vec(Math.cos(a), Math.sin(a));
        const probe = add(this.position, scale(tryDir, ahead));
        if (!world.walls.overlaps(probe, this.radius)) {
          this.turnDir = sign; // commit to this turn direction
          return scale(tryDir, speed);
        }
      }
    }
    return desired; // boxed in — let collision resolution sort it out
  }
}
