import {
  add,
  distance,
  lerp,
  limit,
  normalize,
  scale,
  sub,
  vec,
  Vec2,
} from "../utils/vec2";
import { Entity, generateId, World } from "./entity";
import { WALL_SIZE } from "./wall";
import { Food } from "./food";
import { Heart } from "./heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "./powerup";
import type { Behaviour } from "../behaviours/behaviour";
import { Navigator } from "../behaviours/navigator";
import { damageCreature } from "./creatures/void-pool";
import { ARCHER_COOLDOWN, Arrow, ARROW_DAMAGE, ARROW_SPEED } from "./arrow";

export type ShapeType =
  | "circle"
  | "oval"
  | "triangle"
  | "rounded-rect"
  | "spiked"
  | "pentagon"
  | "crystal"
  | "trap";

/**
 * One concentric destructible shell around a creature's body — the Shard of
 * Death's "crusts". Shells are stored outermost-first (see `Creature.crusts`).
 * `thickness` is how far this shell extends the body's collision radius while it
 * still stands; when its `hp` reaches zero the shell shatters, the radius shrinks
 * by `thickness`, and the next shell inward becomes exposed.
 */
export interface Crust {
  hp: number;
  maxHp: number;
  thickness: number;
}

/** How long (ms) a provoked defender stays hostile after the last hit it takes. */
const RETALIATION_MS = 2000;

/**
 * Squeeze-damage rate (HP/sec) applied when a creature is packed so tightly
 * against other creatures that it can barely move. This prevents the map from
 * locking up when too many creatures are crammed into a small arena — the
 * excess are slowly culled, keeping the simulation fluid.
 */
const SQUEEZE_DAMAGE_RATE = 20;

/**
 * Minimum number of overlapping neighbours for squeeze damage to kick in.
 * Fewer than this and the creature has enough breathing room to be fine.
 */
const SQUEEZE_NEIGHBOUR_MIN = 4;

/**
 * Velocity fraction of `maxSpeed` below which a creature is considered
 * "squeezed" — it's being pressed in on all sides and can't make useful
 * progress.
 */
const SQUEEZE_SPEED_THRESHOLD = 0.08;

/**
 * Seconds a creature must remain squeezed before squeeze damage starts. A
 * short grace period so momentary crowding doesn't punish creatures that are
 * just passing through each other.
 */
const SQUEEZE_GRACE_SECONDS = 0.8;

/**
 * Fastest a creature may pivot its facing, in radians per second — a full turn
 * (360°) per second. Caps how quickly `facing` swings toward the heading of the
 * velocity vector so creatures rotate smoothly rather than snapping around.
 */
const MAX_TURN_RATE = Math.PI;

/** HP a Healer restores to each nearby ally per pulse. */
const HEAL_AMOUNT = 20;
/** Seconds of sim time between a Healer's healing pulses. */
const HEAL_INTERVAL = 2;

/**
 * How much an Elite creature multiplies its base combat stats. Elites are rare
 * (see the spawn roll in the panel), share their species' behaviour, and only
 * differ by these juiced stats and the red pulsating aura the renderer draws.
 */
export const ELITE_STAT_MULTIPLIER = 10;

/**
 * Default alt (structure) damage per second every creature deals to dirt blocks
 * and Spawner towers it presses against — see `altDamage`. A flat, uniform
 * value: dirt (100 HP) crumbles in ~5s. Stone is indestructible and unaffected.
 * Independent of combat `damage`, so even peaceful, harmless creatures dig their
 * way out when boxed in.
 */
export const ALT_DAMAGE_DEFAULT = 20;

/**
 * How far a trapped creature will look for a dirt block to dig its way out.
 * Generous enough to find the wall of any reasonable enclosure, and the scan is
 * throttled (see `nextEscapeScan`) so the cost stays negligible.
 */
const ESCAPE_RANGE = 600;
/** Seconds between a trapped creature's re-scans for the nearest dirt block. */
const ESCAPE_RESCAN = 0.4;
/**
 * A creature with no concrete goal is considered trapped when the open floor it
 * can reach is smaller than this many cells — big enough that any real pen reads
 * as a trap, small enough that an open-map roamer never does. Bounds the cost of
 * the enclosure flood-fill (see `WallGrid.isEnclosed`).
 */
const TRAP_CELL_CAP = 256;
/** Seconds between enclosure re-checks for a goalless creature. */
const TRAP_CHECK_INTERVAL = 1;

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
   * Alt (structure) damage per second. Used to grind down blocks (stone/dirt)
   * and Spawner towers — not living creatures, which take contact `damage`.
   * Defaults to ALT_DAMAGE_DEFAULT when omitted.
   */
  altDamage?: number;
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
  /**
   * Concentric destructible shells around the body (the Shard of Death's
   * crusts), ordered outermost-first. While any survive, every incoming hit is
   * soaked by the outermost shell before the creature's own health takes a
   * scratch (see `damageCreature`), and the body's collision radius is grown by
   * the sum of the living shells' thicknesses — so the boss is physically bigger
   * while armoured and shrinks back to `radius` as its crusts shatter. Omit for
   * every other creature.
   */
  crusts?: { hp: number; thickness: number }[];
}

export class Creature implements Entity {
  id: number;
  position: Vec2;
  velocity: Vec2 = vec(0, 0);
  /**
   * The direction the creature visually faces, in radians. It chases the
   * heading implied by `velocity` but is rate-limited (see MAX_TURN_RATE) so a
   * creature pivots smoothly instead of snapping — crucially, it never reads
   * the garbage angle of a near-zero velocity vector mid-turn, which used to
   * make creatures flip 180° and spin when changing direction to face a foe.
   */
  facing = 0;
  isAlive = true;

  /**
   * A non-combatant structure that nothing can damage and nobody targets (the
   * Creative Spawner). See `alliedWith`, which treats an indestructible body as
   * everyone's ally so no behaviour ever hunts, fears or shoots it, and
   * `damageCreature`, which no-ops any hit against it.
   */
  indestructible = false;

  /**
   * A Spawner tower: attackers grind it down with their alt (structure) damage
   * rather than melee `attackDamage`, exactly as they dig blocks — so even a
   * harmless, zero-damage creature can topple a tower. Faction loyalty still
   * applies, so a tower's own brood won't turn on it. Set true by Spawner.
   */
  structureTarget = false;

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
  /** Per-second damage this creature deals to blocks and spawner towers. */
  altDamage: number;
  perceptionRadius: number;
  behaviour: Behaviour;
  faction: string;
  infiniteEnergy: boolean;
  canEatFood: boolean;
  canPickupPowerups: boolean;

  /**
   * Body radius beneath any crust shells. Equals `radius` for a creature with no
   * crusts; for the Shard of Death it's the bare core the crystal is drawn at,
   * while `radius` (the collision size) bulges out to cover the living shells.
   */
  coreRadius: number;
  /**
   * Concentric destructible shells, outermost-first. Empty for almost every
   * creature; the Shard of Death carries three. See `CreatureConfig.crusts`.
   */
  crusts: Crust[] = [];

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
   * A Healer is a rare variant that deals no damage (its combat stats are
   * stripped, even on a predator) and instead pulses healing to nearby faction
   * allies — see `maybeHeal`. Set by makeHealer() right after construction. A
   * creature is at most one of Elite, Archer, or Healer.
   */
  isHealer = false;

  /** Sim-time (`world.time`) at which a Healer may pulse its next heal. */
  private nextHealTime = 0;

  /**
   * How long (sim-seconds) this creature has been squeezed with no room to
   * move. Once it exceeds SQUEEZE_GRACE_SECONDS, damage is applied every tick.
   */
  private squeezeTime = 0;

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
    this.altDamage = config.altDamage ?? ALT_DAMAGE_DEFAULT;
    this.perceptionRadius = config.perceptionRadius;
    this.behaviour = config.behaviour;
    this.faction = config.faction ?? "";
    this.infiniteEnergy = config.infiniteEnergy ?? false;
    this.canEatFood = config.canEatFood ?? true;
    this.canPickupPowerups = config.canPickupPowerups ?? true;
    // Crust shells: the bare body is `radius`; each living shell bulges the
    // collision radius out by its thickness until it shatters.
    this.coreRadius = config.radius;
    if (config.crusts && config.crusts.length > 0) {
      this.crusts = config.crusts.map((c) => ({
        hp: c.hp,
        maxHp: c.hp,
        thickness: c.thickness,
      }));
      this.radius =
        this.coreRadius + this.crusts.reduce((s, c) => s + c.thickness, 0);
    }
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
   * Promote this creature to a Healer: it loses all offensive ability (damage
   * and retaliation are zeroed, so even a predator can't hurt anything) and
   * instead pulses healing to nearby faction allies (see `maybeHeal`). Returns
   * `this` for chaining at the spawn site.
   */
  makeHealer(): this {
    this.isHealer = true;
    this.damage = 0;
    this.retaliation = 0;
    return this;
  }

  /**
   * True if `other` is a loyal ally: both share the same non-empty faction.
   * Allies never damage one another and won't hunt each other. An empty
   * faction means "no allegiance", so it's allied with nobody (not even other
   * factionless creatures) — preserving every-creature-for-itself by default.
   */
  alliedWith(other: Creature): boolean {
    // An indestructible structure (the Creative Spawner) is a non-combatant: it
    // counts as allied with everyone so no behaviour ever picks it as a target,
    // flees it, or tries to damage it. This single rule covers every targeting
    // loop, since they all skip allies.
    if (this.indestructible || other.indestructible) return true;
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

  /**
   * Snapshot the active temporary boosts as *remaining* durations (ms) plus
   * their multipliers — clock-independent, so they survive a save/load and can
   * be re-applied later with applyShield/applySpeed/applySword.
   */
  captureBoosts(): {
    shieldMs: number;
    speedMs: number;
    speedMult: number;
    swordMs: number;
    swordMult: number;
  } {
    const now = performance.now();
    return {
      shieldMs: Math.max(0, this.shieldedUntil - now),
      speedMs: Math.max(0, this.spedUpUntil - now),
      speedMult: this.speedBoost,
      swordMs: Math.max(0, this.armedUntil - now),
      swordMult: this.swordFactor,
    };
  }

  update(dt: number, world: World) {
    if (!this.isAlive) return;

    const nearby = world.getNearby(this.position, this.perceptionRadius);

    // An archer looses arrows at enemies on top of whatever it's doing.
    if (this.isArcher) this.maybeFireArrow(nearby, world);
    // A healer pulses healing to nearby allies on top of whatever it's doing.
    if (this.isHealer) this.maybeHeal(nearby, world);

    this.steerTarget = null; // behaviours set this via the navigator if they seek
    // Combat reflexes override the base behaviour, in priority order:
    //   1. retaliate — a provoked creature charges whoever just hit it;
    //   2. assist — a faction fighter rushes to help an ally under attack.
    // Both fall through to the creature's normal behaviour when neither applies.
    let desired =
      this.retaliationDrive(nearby, world) ??
      this.assistAllyDrive(nearby, world) ??
      this.behaviour.decide(this, nearby, world);

    // Decide whether we're trapped, then dig our way out. Two ways to be trapped:
    //   (a) we picked a goal that's walled off with no route (food outside a
    //       sealed pen) — the navigator flagged it unreachable; or
    //   (b) we have no goal at all but we're boxed into a small enclosed pocket
    //       (a goalless grazer in a pen) — found by a throttled flood-fill.
    // Either way, head for the nearest breakable (dirt) block and tunnel out
    // instead of grinding blindly into the barrier (which made them orbit and
    // clump). Once a gap opens the creature reads as free again and carries on.
    if (this.steerTarget !== null) {
      // We chose a concrete goal this frame: trapped iff it's unreachable.
      this.trapped = this.nav.unreachable;
    } else if (world.time >= this.nextTrapCheck) {
      // No goal — periodically test whether we're sealed into a small pocket.
      this.trapped = world.walls.isEnclosed(
        this.position,
        this.radius,
        world.arenaWidth,
        world.arenaHeight,
        TRAP_CELL_CAP,
      );
      this.nextTrapCheck = world.time + TRAP_CHECK_INTERVAL;
    }
    // (else: goalless and within the check interval — keep the last verdict.)

    let ramBlock = false;
    if (this.trapped) {
      const escape = this.escapeWhenTrapped(world);
      desired = escape.dir;
      ramBlock = escape.ram;
    }

    // While ramming a chosen block to dig it out, skip wall avoidance — it would
    // deflect the creature into sliding along the wall and it would never bite.
    const steered = ramBlock ? desired : this.avoidWalls(desired, world);
    this.velocity = limit(
      lerp(this.velocity, steered, Math.min(1, dt * 8)),
      this.maxSpeed,
    );
    this.updateFacing(dt);
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
          // We're actively driving into this block to get somewhere — the only
          // time a creature digs. Grind through any dirt in the way (stone is
          // indestructible and shrugs it off), so a creature boxed in by dirt
          // can break out instead of grinding against it forever. Done here,
          // while still overlapping, before the eject below moves us clear.
          if (
            world.walls.dig(this.position, this.radius, this.altDamage * dt)
          ) {
            this.lastActivity = "Digging out";
          }
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

        // A shielded target shrugs everything off, and loyal allies (same
        // faction) never hurt each other — so the boss and its spawned spikers
        // pile together harmlessly, and a tower's own brood won't topple it.
        if (!e.isShielded && !this.alliedWith(e)) {
          if (e.structureTarget) {
            // A Spawner tower is ground down by our alt (structure) damage, the
            // same stat that digs blocks — never melee. Even harmless, zero-
            // damage creatures can topple a tower this way. It deals no contact
            // damage and never retaliates, so there's nothing to provoke or feed on.
            damageCreature(e, this.altDamage * dt, world);
          } else if (this.attackDamage > 0) {
            // Living prey takes our melee contact damage (aggressive/predator,
            // or a provoked defender fighting back).
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
    }

    // Squeeze damage: when the creature is packed so tightly against other
    // creatures that it can barely move, it slowly takes damage. This prevents
    // the map from locking up when too many creatures are crammed into a small
    // arena — the excess are culled, keeping the simulation fluid.
    const squeezeNeighbours = this.countOverlapping(nearby);
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (
      squeezeNeighbours >= SQUEEZE_NEIGHBOUR_MIN &&
      speed < this.maxSpeed * SQUEEZE_SPEED_THRESHOLD
    ) {
      this.squeezeTime += dt;
      if (this.squeezeTime > SQUEEZE_GRACE_SECONDS) {
        this.health -= SQUEEZE_DAMAGE_RATE * dt;
      }
    } else {
      this.squeezeTime = Math.max(0, this.squeezeTime - dt * 2);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.deathTime = performance.now();
    }
  }

  /**
   * Pivot `facing` toward the heading of the current velocity, capped at
   * MAX_TURN_RATE. A near-stationary creature keeps its current facing (a
   * near-zero velocity has no meaningful direction), which is what stops the
   * spin-out when a creature decelerates through zero to reverse course.
   */
  private updateFacing(dt: number) {
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (speed < 1e-3) return; // no heading worth chasing — hold steady
    const target = Math.atan2(this.velocity.y, this.velocity.x);
    // Shortest signed angular distance, wrapped to (-π, π].
    let delta = target - this.facing;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const maxStep = MAX_TURN_RATE * dt;
    if (delta > maxStep) delta = maxStep;
    else if (delta < -maxStep) delta = -maxStep;
    this.facing += delta;
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
   * Healer pulse: every HEAL_INTERVAL seconds, top up every living faction ally
   * in perception by HEAL_AMOUNT (capped at their max health). It never heals
   * itself, but other healers count as allies, so a pair of healers keep each
   * other patched up.
   */
  private maybeHeal(nearby: Entity[], world: World) {
    if (world.time < this.nextHealTime) return;
    this.nextHealTime = world.time + HEAL_INTERVAL;

    for (const e of nearby) {
      if (e === this || !e.isAlive || !(e instanceof Creature)) continue;
      if (!this.alliedWith(e)) continue; // only mend our own faction
      if (e.health >= e.maxHealth) continue;
      e.health = Math.min(e.maxHealth, e.health + HEAL_AMOUNT);
    }
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

  /** Heading for the idle roam used when trapped with no dirt to dig. */
  private wanderAngle = Math.random() * Math.PI * 2;

  /** Dedicated navigator for the escape path, kept apart from the main `nav`
   * so the (reachable) route to a dirt block and the (failing) search to the
   * real goal don't thrash each other's cached path. */
  private escapeNav = new Navigator();
  /** Cached dirt block the creature is currently digging toward, if any. */
  private escapeTarget: Vec2 | null = null;
  /** Sim-time at which the trapped creature may re-scan for the nearest dirt. */
  private nextEscapeScan = 0;
  /** Cached verdict: is the creature currently boxed in? Re-evaluated periodically. */
  private trapped = false;
  /** Sim-time at which a goalless creature may re-run the enclosure check. */
  private nextTrapCheck = 0;

  /**
   * Trapped-escape steering: head for the nearest breakable (dirt) block and
   * dig out. Two phases:
   *  - far from the block, route toward it on a dedicated navigator (so the
   *    failing search to the real goal isn't thrashed);
   *  - once adjacent, drive *straight into* the block at full speed so the
   *    contact-dig in `update` actually bites — `ram: true` tells the caller to
   *    skip wall avoidance, which would otherwise deflect it into a useless
   *    slide along the wall (the bug that left trapped creatures inert).
   * The dirt scan is throttled to ESCAPE_RESCAN so even a crowd of trapped
   * creatures costs little. Falls back to a calm wander only when sealed in by
   * pure indestructible stone — nothing to dig.
   */
  private escapeWhenTrapped(world: World): { dir: Vec2; ram: boolean } {
    if (world.time >= this.nextEscapeScan || this.escapeTarget === null) {
      const dirt = world.walls.nearestDirtBlock(this.position, ESCAPE_RANGE);
      this.escapeTarget = dirt ? { ...dirt.position } : null;
      this.nextEscapeScan = world.time + ESCAPE_RESCAN;
    }

    if (this.escapeTarget) {
      const toBlock = sub(this.escapeTarget, this.position);
      const dist = Math.hypot(toBlock.x, toBlock.y);
      // Adjacent: shove straight into the block to grind through it.
      if (dist < WALL_SIZE + this.radius + 6) {
        this.steerTarget = { ...this.escapeTarget };
        this.lastActivity = "Trapped — digging out";
        if (dist < 1e-3) return { dir: vec(0, 0), ram: true };
        return { dir: scale(toBlock, this.maxSpeed / dist), ram: true };
      }
      // Still approaching: route toward the block around any inner obstacles.
      this.lastActivity = "Trapped — heading for soft ground";
      return {
        dir: this.escapeNav.seek(this, this.escapeTarget, world),
        ram: false,
      };
    }

    // Boxed in by indestructible stone — nothing to dig; mill about calmly.
    this.steerTarget = null;
    this.lastActivity = "Trapped — no way out";
    this.wanderAngle += (Math.random() - 0.5) * 0.6;
    return {
      dir: vec(
        Math.cos(this.wanderAngle) * this.maxSpeed * 0.5,
        Math.sin(this.wanderAngle) * this.maxSpeed * 0.5,
      ),
      ram: false,
    };
  }

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

  /**
   * Count how many other living creatures overlap this one's body (within a
   * small extra margin so creatures pressed edge-to-edge are still counted).
   * Used by the squeeze-damage mechanic to decide whether the creature is
   * too tightly packed to move.
   */
  private countOverlapping(nearby: Entity[]): number {
    let count = 0;
    for (const e of nearby) {
      if (e === this || !e.isAlive || !(e instanceof Creature)) continue;
      if (distance(this.position, e.position) < this.radius + e.radius + 4) {
        count++;
      }
    }
    return count;
  }
}
