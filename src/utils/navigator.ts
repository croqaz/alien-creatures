import { vec, vecSub, vecLen, vecNorm, vecMul, vecClampLen } from "./math";
import type { Vec2 } from "./math";

/**
 * Simple steering navigator for smooth creature movement.
 */
export class Navigator {
  targetPos: Vec2 | null = null;

  setTarget(pos: Vec2): void {
    this.targetPos = pos;
  }

  clearTarget(): void {
    this.targetPos = null;
  }

  /**
   * Returns a steering force towards the target using simple seek + arrival.
   */
  getSteering(
    currentPos: Vec2,
    currentVel: Vec2,
    maxSpeed: number,
    _dt: number,
  ): Vec2 {
    if (!this.targetPos) return vec(0, 0);

    const desired = vecSub(this.targetPos, currentPos);
    const dist = vecLen(desired);
    if (dist < 1.5) {
      return vec(0, 0); // arrived
    }

    // Arrival: slow down when close
    const slowingRadius = 60;
    let speed = maxSpeed;
    if (dist < slowingRadius) {
      speed = maxSpeed * (dist / slowingRadius);
    }
    speed = Math.max(speed, maxSpeed * 0.15);

    const desiredVel = vecMul(vecNorm(desired), speed);
    const steer = vecSub(desiredVel, currentVel);
    return vecClampLen(steer, maxSpeed * 4); // steering force limit
  }
}
