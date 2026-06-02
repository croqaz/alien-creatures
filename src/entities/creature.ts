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
import type { Behaviour } from "../behaviours/behaviour";
import { Navigator } from "../behaviours/navigator";

export type ShapeType =
  | "circle"
  | "oval"
  | "triangle"
  | "rounded-rect"
  | "spiked";

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
    this.steerTarget = null; // behaviours set this via the navigator if they seek
    const desired = this.behaviour.decide(this, nearby, world);
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
        this.energy = Math.min(this.maxEnergy, this.energy + e.nutrition);
        // Carnivores (damage > 0) draw only energy from plant food — no healing.
        // Herbivores also heal from it.
        if (this.damage <= 0) {
          this.health = Math.min(this.maxHealth, this.health + e.nutrition);
        }
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
          const wasAlive = e.health > 0;
          e.health -= this.damage * dt;
          // Landing the killing blow lets a carnivore feed on the prey,
          // healing it 4x what a normal piece of food (25) would.
          if (wasAlive && e.health <= 0) {
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
