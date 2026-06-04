import { Vec2 } from "../utils/vec2";
import { Entity, World, generateId } from "./entity";

/**
 * A shield power-up. The first of what may become a family of power-ups, so it
 * carries the effect's parameters (here just `duration`) rather than hard-coding
 * them at the pickup site. A creature that touches it becomes indestructible —
 * no damage taken and no energy drain — for `duration` ms. Rendered noticeably
 * larger than food/hearts so it reads as a special object.
 */
export class ShieldPowerup implements Entity {
  id: number;
  isAlive = true;
  // Roughly double a heart's radius (8) so it's clearly the biggest pickup.
  radius = 16;
  /** How long the shield lasts once collected, in milliseconds. */
  duration: number;
  color: string;
  spawnTime: number;

  constructor(
    public position: Vec2,
    duration = 10_000,
    color = "#3cf",
  ) {
    this.id = generateId();
    this.duration = duration;
    this.color = color;
    this.spawnTime = performance.now();
  }

  update(_dt: number, _world: World) {
    // Power-ups are static
  }
}

/**
 * A speed power-up. A creature that touches it moves `multiplier`× faster for
 * `duration` ms. Same footprint as the shield so power-ups read consistently.
 */
export class SpeedPowerup implements Entity {
  id: number;
  isAlive = true;
  radius = 16;
  /** Speed multiplier applied while active. */
  multiplier: number;
  /** How long the boost lasts once collected, in milliseconds. */
  duration: number;
  color: string;
  spawnTime: number;

  constructor(
    public position: Vec2,
    multiplier = 2,
    duration = 15_000,
    color = "#fc3",
  ) {
    this.id = generateId();
    this.multiplier = multiplier;
    this.duration = duration;
    this.color = color;
    this.spawnTime = performance.now();
  }

  update(_dt: number, _world: World) {
    // Power-ups are static
  }
}

/**
 * A sword power-up. Only fighting creatures (predators, aggressors, retaliators)
 * can pick it up — others pass through. While active it multiplies the wielder's
 * contact damage by `multiplier` for `duration` ms.
 */
export class SwordPowerup implements Entity {
  id: number;
  isAlive = true;
  radius = 16;
  /** Contact-damage multiplier applied while active. */
  multiplier: number;
  /** How long the boost lasts once collected, in milliseconds. */
  duration: number;
  color: string;
  spawnTime: number;

  constructor(
    public position: Vec2,
    multiplier = 1.5,
    duration = 15_000,
    color = "#d66",
  ) {
    this.id = generateId();
    this.multiplier = multiplier;
    this.duration = duration;
    this.color = color;
    this.spawnTime = performance.now();
  }

  update(_dt: number, _world: World) {
    // Power-ups are static
  }
}
