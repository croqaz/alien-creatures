import { Entity, EntityKind } from "./entity";
import type { World } from "../core/world";
import type { Vec2 } from "../utils/math";
import { vec, vecAdd, vecDist, vecMul, vecClampLen } from "../utils/math";
import { Navigator } from "../utils/navigator";
import { SPECIES, ENERGY_DRAIN_INTERVAL, STARVATION_DPS } from "../core/config";
import { BuffType } from "./buffs";
import type { Behaviour, BehaviourContext } from "../behaviours/index";
import { evaluateBehaviours } from "../behaviours/index";

export type CreatureSpecies =
  | "blob"
  | "floater"
  | "crawler"
  | "defender"
  | "lurker"
  | "spiker";

export class Creature implements Entity {
  readonly kind = EntityKind.Creature;

  id = 0;
  species: CreatureSpecies;
  faction?: string;
  color: string;
  accentColor: string;
  shape: "circle" | "square" | "triangle" | "spiky";
  radius: number;
  maxSpeed: number;
  speed: number; // effective speed (after buffs)

  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;

  damage: number;
  baseDamage: number;
  retaliation: number;
  baseRetaliation: number;
  perceptionRadius: number;

  position: Vec2;
  velocity: Vec2 = vec(0, 0);
  nav = new Navigator();

  // Behaviours – assigned per species
  behaviours: Behaviour[] = [];

  // State tracking
  currentAction = "Wandering";
  actionTarget: Entity | null = null;

  // Combat
  lastAttacker: Creature | null = null;
  retaliationTimer = 0;
  attackCooldown = 0;

  // Buffs
  activeBuffs: Map<BuffType, number> = new Map();

  // Faction / spawner link
  spawnerId?: number;

  // Energy drain accumulator
  private energyAccum = 0;

  constructor(
    species: CreatureSpecies,
    pos: Vec2,
    faction?: string,
    spawnerId?: number,
  ) {
    const cfg = SPECIES[species];
    this.species = species;
    this.faction = faction;
    this.spawnerId = spawnerId;
    this.color = cfg.color;
    this.accentColor = cfg.accentColor;
    this.shape = cfg.shape;
    this.radius = cfg.radius;
    this.maxSpeed = cfg.maxSpeed;
    this.speed = cfg.maxSpeed;
    this.maxHealth = cfg.maxHealth;
    this.health = cfg.maxHealth;
    this.maxEnergy = cfg.maxEnergy;
    this.energy = cfg.maxEnergy;
    this.baseDamage = cfg.damage;
    this.damage = cfg.damage;
    this.baseRetaliation = cfg.retaliation;
    this.retaliation = cfg.retaliation;
    this.perceptionRadius = cfg.perceptionRadius;
    this.position = { x: pos.x, y: pos.y };
  }

  /** Whether this creature is aggressive by nature */
  get isAggressive(): boolean {
    return SPECIES[this.species].isAggressive;
  }

  /** Effective damage output (base + buffs) */
  get effectiveDamage(): number {
    if (this.activeBuffs.has(BuffType.Dagger)) {
      return this.damage * 2;
    }
    return this.damage;
  }

  /** Effective retaliation (base + buffs) */
  get effectiveRetaliation(): number {
    if (this.activeBuffs.has(BuffType.Dagger)) {
      return this.retaliation * 2;
    }
    return this.retaliation;
  }

  get isInvulnerable(): boolean {
    return this.activeBuffs.has(BuffType.Shield);
  }

  get isSpedUp(): boolean {
    return this.activeBuffs.has(BuffType.Speed);
  }

  get effectiveMaxSpeed(): number {
    return this.isSpedUp ? this.maxSpeed * 2 : this.maxSpeed;
  }

  // ── Helpers ──

  canAttack(other: Creature): boolean {
    if (other === this) return false;
    if (other.health <= 0) return false;
    if (other.isInvulnerable) return false;
    // Same faction = peaceful
    if (this.faction && other.faction && this.faction === other.faction)
      return false;
    return true;
  }

  takeDamage(amount: number, attacker?: Creature): void {
    if (this.isInvulnerable) return;
    if (this.health === Infinity) return;
    this.health = Math.max(0, this.health - amount);
    if (attacker) {
      this.lastAttacker = attacker;
      // Defender retaliation trigger
      if (this.retaliation > 0) {
        this.retaliationTimer = 3; // retaliate for 3 seconds
      }
    }
  }

  heal(amount: number): void {
    if (this.health === Infinity) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addEnergy(amount: number): void {
    if (this.energy === Infinity) return;
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  // ── Buff management ──

  applyBuff(type: BuffType, duration: number): void {
    this.activeBuffs.set(type, (this.activeBuffs.get(type) ?? 0) + duration);
    if (type === BuffType.Speed) this.speed = this.effectiveMaxSpeed;
  }

  private updateBuffs(dt: number): void {
    for (const [type, remaining] of this.activeBuffs.entries()) {
      const newRemaining = remaining - dt;
      if (newRemaining <= 0) {
        this.activeBuffs.delete(type);
        if (type === BuffType.Speed) this.speed = this.effectiveMaxSpeed;
        if (type === BuffType.Dagger) {
          this.damage = this.baseDamage;
          this.retaliation = this.baseRetaliation;
        }
      } else {
        this.activeBuffs.set(type, newRemaining);
      }
    }
  }

  // ── Main update ──

  update(dt: number, world: World): void {
    if (this.health <= 0) return;

    // Update buffs
    this.updateBuffs(dt);

    // Update retaliation timer
    if (this.retaliationTimer > 0) {
      this.retaliationTimer = Math.max(0, this.retaliationTimer - dt);
    }

    // Attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }

    // Energy drain: 1 energy every ENERGY_DRAIN_INTERVAL seconds
    if (this.energy !== Infinity && !this.isInvulnerable) {
      this.energyAccum += dt;
      while (this.energyAccum >= ENERGY_DRAIN_INTERVAL) {
        this.energyAccum -= ENERGY_DRAIN_INTERVAL;
        if (this.energy > 0) {
          this.energy = Math.max(0, this.energy - 1);
        }
      }
    }

    // Starvation damage
    if (
      this.energy <= 0 &&
      this.energy !== Infinity &&
      this.health !== Infinity
    ) {
      this.health = Math.max(0, this.health - STARVATION_DPS * dt);
      if (this.health <= 0) return;
    }

    // Recalculate speed
    this.speed = this.effectiveMaxSpeed;

    // Evaluate behaviours
    const ctx: BehaviourContext = { creature: this, world };
    const action = evaluateBehaviours(this.behaviours, ctx);
    if (action) {
      this.currentAction = action.description;
      this.actionTarget = action.target ?? null;
      this.nav.setTarget(action.targetPos);
    } else {
      this.currentAction = "Wandering";
      this.actionTarget = null;
    }

    // Apply steering
    const steering = this.nav.getSteering(
      this.position,
      this.velocity,
      this.speed,
      dt,
    );
    this.velocity = vecClampLen(
      vecAdd(this.velocity, vecMul(steering, dt)),
      this.speed,
    );

    // If no nav target, apply random wandering
    if (!this.nav.targetPos) {
      // Wander: random direction changes
      const wanderAngle = Math.random() * Math.PI * 2;
      const wanderForce = vecMul(
        { x: Math.cos(wanderAngle), y: Math.sin(wanderAngle) },
        this.speed * 0.5 * dt,
      );
      this.velocity = vecClampLen(
        vecAdd(this.velocity, wanderForce),
        this.speed,
      );
    }

    // Update position
    this.position = vecAdd(this.position, vecMul(this.velocity, dt));

    // Clamp to arena
    this.position.x = Math.max(
      this.radius,
      Math.min(world.arenaWidth - this.radius, this.position.x),
    );
    this.position.y = Math.max(
      this.radius,
      Math.min(world.arenaHeight - this.radius, this.position.y),
    );

    // Attack logic
    this.performAttacks(world);
  }

  private performAttacks(_world: World): void {
    const attackDamage =
      this.retaliationTimer > 0
        ? this.effectiveRetaliation
        : this.effectiveDamage;

    if (attackDamage <= 0) return;

    const target =
      this.retaliationTimer > 0
        ? this.lastAttacker
        : (this.actionTarget as Creature | null);

    if (!target || !(target instanceof Creature)) return;
    if (!this.canAttack(target)) return;

    const dist = vecDist(this.position, target.position);
    const attackRange = this.radius + target.radius + 8;

    if (dist <= attackRange && this.attackCooldown <= 0) {
      target.takeDamage(attackDamage * 0.1, this); // per-frame scaled
      this.attackCooldown = 0.1; // 10 attacks per second when in range
    }
  }
}
