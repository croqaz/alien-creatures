import { Vec2, vec, add, scale, limit, distance, sub, normalize, lerp } from '../utils/vec2';
import { Entity, World, generateId } from './entity';
import { Food } from './food';
import type { Behaviour } from '../behaviours/behaviour';

export type ShapeType = 'circle' | 'oval' | 'triangle' | 'rounded-rect' | 'spiked';

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
  perceptionRadius: number;
  behaviour: Behaviour;
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
  maxSpeed: number;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  damage: number;
  perceptionRadius: number;
  behaviour: Behaviour;

  deathTime = 0;
  spawnTime: number;
  lastActivity = 'Idle';

  constructor(position: Vec2, config: CreatureConfig) {
    this.id = generateId();
    this.position = { ...position };
    this.species = config.species;
    this.color = config.color;
    this.accentColor = config.accentColor;
    this.shape = config.shape;
    this.radius = config.radius;
    this.maxSpeed = config.maxSpeed;
    this.health = config.maxHealth;
    this.maxHealth = config.maxHealth;
    this.energy = config.maxEnergy;
    this.maxEnergy = config.maxEnergy;
    this.damage = config.damage;
    this.perceptionRadius = config.perceptionRadius;
    this.behaviour = config.behaviour;
    this.spawnTime = performance.now();
  }

  update(dt: number, world: World) {
    if (!this.isAlive) return;

    const nearby = world.getNearby(this.position, this.perceptionRadius);
    const desired = this.behaviour.decide(this, nearby, world);
    this.velocity = limit(lerp(this.velocity, desired, Math.min(1, dt * 8)), this.maxSpeed);
    this.position = add(this.position, scale(this.velocity, dt));

    // Clamp to arena
    const margin = this.radius;
    if (this.position.x < margin) { this.position.x = margin; this.velocity.x *= -0.5; }
    if (this.position.x > world.arenaWidth - margin) { this.position.x = world.arenaWidth - margin; this.velocity.x *= -0.5; }
    if (this.position.y < margin) { this.position.y = margin; this.velocity.y *= -0.5; }
    if (this.position.y > world.arenaHeight - margin) { this.position.y = world.arenaHeight - margin; this.velocity.y *= -0.5; }

    // Energy drain
    this.energy -= dt * 0.4;
    if (this.energy <= 0) {
      this.energy = 0;
      this.health -= dt * 10;
    }

    // Interactions with nearby entities
    for (const e of nearby) {
      if (e === this || !e.isAlive) continue;
      const d = distance(this.position, e.position);

      // Eat food
      if (e instanceof Food && d < this.radius + e.radius) {
        e.isAlive = false;
        // Predators and aggressors (damage > 0) get 4x the healing from food.
        const healMultiplier = this.damage > 0 ? 4 : 1;
        this.energy = Math.min(this.maxEnergy, this.energy + e.nutrition);
        this.health = Math.min(this.maxHealth, this.health + e.nutrition * healMultiplier);
      }

      // Creature collision
      if (e instanceof Creature && d < this.radius + e.radius && d > 0) {
        // Push apart
        const pushDir = normalize(sub(this.position, e.position));
        const overlap = (this.radius + e.radius - d) * 0.5;
        this.position = add(this.position, scale(pushDir, overlap));
        e.position = add(e.position, scale(pushDir, -overlap));

        // Damage if aggressive/predator
        if (this.damage > 0) {
          e.health -= this.damage * dt;
        }
      }
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.deathTime = performance.now();
    }
  }
}
