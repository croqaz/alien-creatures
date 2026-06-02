import {
  Vec2,
  vec,
  add,
  sub,
  scale,
  normalize,
  distance,
  magnitude,
} from "../utils/vec2";
import type { Creature } from "../entities/creature";
import type { World } from "../entities/entity";
import { WALL_SIZE } from "../entities/wall";
import { findPath } from "../utils/pathfinding";

// Replan no more often than this (seconds of sim time) per creature. A moving
// target only forces a fresh search after it has drifted a cell away, so most
// frames reuse the cached path.
const REPLAN_INTERVAL = 0.4;
// Goal must move at least this far before we throw away the current path.
const GOAL_DRIFT = WALL_SIZE;
// Distance at which a waypoint counts as reached.
const ARRIVE_RADIUS = WALL_SIZE * 0.6;
// How far ahead a fleeing creature aims for its retreat point.
const FLEE_DISTANCE = 260;

/**
 * Per-creature navigation helper. Behaviours hand it a goal (prey, food) or a
 * flee direction and get back a desired velocity that routes around walls.
 *
 * The common case — open ground with a clear line of sight to the target — is
 * handled by steering straight at it, exactly as before. Only when a wall sits
 * between the creature and its goal does it fall back to an A* path, which it
 * then caches and follows via string-pulling so movement stays smooth.
 */
export class Navigator {
  private path: Vec2[] = [];
  private goal: Vec2 | null = null;
  private lastPlan = -Infinity;

  /**
   * Desired velocity (magnitude `speed`, defaulting to the creature's max) that
   * moves toward `goal` while avoiding walls.
   */
  seek(creature: Creature, goal: Vec2, world: World, speed?: number): Vec2 {
    const spd = speed ?? creature.maxSpeed;
    // Tell wall avoidance where we're headed so it stands down on final approach.
    creature.steerTarget = { ...goal };
    const toGoal = sub(goal, creature.position);
    const goalDist = magnitude(toGoal);
    if (goalDist < 1e-3) return vec(0, 0);

    // No walls, or a clear shot: steer straight and forget any stale path.
    if (
      world.walls.isEmpty() ||
      this.lineClear(creature.position, goal, creature.radius, world)
    ) {
      this.path = [];
      this.goal = null;
      return scale(toGoal, spd / goalDist);
    }

    this.ensurePath(creature, goal, world);
    if (this.path.length === 0) {
      // No route found — head roughly toward the goal and let the creature's
      // own reactive wall-avoidance try to slip around.
      return scale(toGoal, spd / goalDist);
    }

    // String-pull: skip any leading waypoints we can already see past, then
    // drop the current one once we've essentially reached it.
    while (
      this.path.length > 1 &&
      this.lineClear(creature.position, this.path[1]!, creature.radius, world)
    ) {
      this.path.shift();
    }
    while (
      this.path.length > 1 &&
      distance(creature.position, this.path[0]!) < ARRIVE_RADIUS
    ) {
      this.path.shift();
    }

    const next = this.path[0]!;
    const dir = sub(next, creature.position);
    const len = magnitude(dir);
    if (len < 1e-3) return scale(toGoal, spd / goalDist);
    return scale(dir, spd / len);
  }

  /**
   * Desired velocity that retreats along `awayDir` while avoiding walls, so a
   * fleeing creature rounds barriers instead of cornering itself against them.
   * `awayDir` need not be normalised.
   */
  flee(creature: Creature, awayDir: Vec2, world: World, speed?: number): Vec2 {
    const spd = speed ?? creature.maxSpeed;
    const away = normalize(awayDir);
    if (away.x === 0 && away.y === 0) return vec(0, 0);

    // Open ground: just run. Pathing to a retreat point only matters when a
    // wall lies in the escape direction.
    const ahead = add(
      creature.position,
      scale(away, creature.radius + WALL_SIZE),
    );
    if (
      world.walls.isEmpty() ||
      !world.walls.overlaps(ahead, creature.radius)
    ) {
      this.path = [];
      this.goal = null;
      return scale(away, spd);
    }

    // Aim for a retreat point and let seek() route around the obstruction.
    let dest = add(creature.position, scale(away, FLEE_DISTANCE));
    dest = {
      x: Math.max(
        creature.radius,
        Math.min(world.arenaWidth - creature.radius, dest.x),
      ),
      y: Math.max(
        creature.radius,
        Math.min(world.arenaHeight - creature.radius, dest.y),
      ),
    };
    return this.seek(creature, dest, world, spd);
  }

  /** (Re)compute the cached path to `goal` when it's missing, stale, or the goal moved. */
  private ensurePath(creature: Creature, goal: Vec2, world: World): void {
    const stale = world.time - this.lastPlan >= REPLAN_INTERVAL;
    const moved = !this.goal || distance(goal, this.goal) > GOAL_DRIFT;
    if (this.path.length > 0 && !stale && !moved) return;

    const path = findPath(
      creature.position,
      goal,
      creature.radius,
      world.walls,
      world.arenaWidth,
      world.arenaHeight,
    );
    this.path = path ?? [];
    this.goal = { ...goal };
    this.lastPlan = world.time;
  }

  /**
   * True if the straight segment a→b stays clear of walls for the given radius.
   * The endpoint itself is not tested: the goal may legitimately sit right
   * against a wall (food/prey in a corner), and that should count as a clear
   * shot, not a blocked one — only walls strictly between a and b matter.
   */
  private lineClear(a: Vec2, b: Vec2, radius: number, world: World): boolean {
    const d = sub(b, a);
    const len = magnitude(d);
    const step = WALL_SIZE * 0.5;
    const steps = Math.ceil(len / step);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const p = add(a, scale(d, t));
      if (world.walls.overlaps(p, radius)) return false;
    }
    return true;
  }
}
