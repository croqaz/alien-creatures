import { Creature } from "../entities/creature";
import type { World } from "../core/world";
import type { Vec2 } from "../utils/math";
import { vec, vecDist, vecSub, vecNorm, vecMul, vecAdd } from "../utils/math";
import type { Entity } from "../entities/entity";
import { EntityKind } from "../entities/entity";
import { Food } from "../entities/food";

// ── Action result ──

export interface CreatureAction {
  description: string;
  target: Entity | null;
  targetPos: Vec2;
}

// ── Behaviour context ──

export interface BehaviourContext {
  creature: Creature;
  world: World;
}

// ── Behaviour interface ──

export interface Behaviour {
  /** Higher priority behaviours are evaluated first */
  priority: number;
  /** Returns an action if this behaviour should activate, otherwise null */
  evaluate(ctx: BehaviourContext): CreatureAction | null;
}

// ── Utility helpers ──

function findClosest(pos: Vec2, candidates: Entity[]): Entity | null {
  let best: Entity | null = null;
  let bestDist = Infinity;
  for (const e of candidates) {
    const d = vecDist(pos, e.position);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

function findClosestOfKind(
  pos: Vec2,
  entities: Entity[],
  kind: EntityKind,
  predicate?: (e: Entity) => boolean,
): Entity | null {
  const filtered = entities.filter((e) => {
    if (e.kind !== kind) return false;
    if (predicate && !predicate(e)) return false;
    return true;
  });
  return findClosest(pos, filtered);
}

function fleeDirection(from: Vec2, threat: Vec2): Vec2 {
  const dir = vecSub(from, threat);
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
  if (len < 0.001) return vec(Math.random() - 0.5, Math.random() - 0.5);
  return vecNorm(dir);
}

// ── 1. Flee Behaviour ──

export class FleeBehaviour implements Behaviour {
  priority = 100;
  private threatFilter: (other: Creature, self: Creature) => boolean;

  /**
   * @param threatFilter - returns true if `other` should be fled from
   */
  constructor(threatFilter: (other: Creature, self: Creature) => boolean) {
    this.threatFilter = threatFilter;
  }

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature, world } = ctx;
    const threats: Creature[] = [];

    for (const e of world.entities) {
      if (!(e instanceof Creature)) continue;
      if (e.health <= 0) continue;
      if (e === creature) continue;
      if (this.threatFilter(e, creature)) {
        const dist = vecDist(creature.position, e.position);
        if (dist <= creature.perceptionRadius) {
          threats.push(e);
        }
      }
    }

    if (threats.length === 0) return null;

    // Find the closest threat
    const closest = findClosest(creature.position, threats) as Creature;
    const fleeVec = fleeDirection(creature.position, closest.position);
    // Flee to a point far away in that direction
    const targetPos = vecAdd(
      creature.position,
      vecMul(fleeVec, creature.perceptionRadius),
    );

    return {
      description: `Running from ${closest.species}`,
      target: closest,
      targetPos,
    };
  }
}

// ── 2. Seek Health Behaviour ──

export class SeekHealthBehaviour implements Behaviour {
  priority = 90;
  private threshold: number; // fraction of maxHealth below which we seek health

  constructor(threshold = 0.5) {
    this.threshold = threshold;
  }

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature, world } = ctx;
    if (creature.health >= creature.maxHealth * this.threshold) return null;

    const heart = findClosestOfKind(
      creature.position,
      world.entities,
      EntityKind.Food,
      (e) => {
        return (e as Food).foodType === "health";
      },
    );

    if (heart) {
      return {
        description: "Looking for health",
        target: heart,
        targetPos: heart.position,
      };
    }
    return null;
  }
}

// ── 3. Seek Energy Behaviour ──

export class SeekEnergyBehaviour implements Behaviour {
  priority = 80;
  private threshold: number;

  constructor(threshold = 0.35) {
    this.threshold = threshold;
  }

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature, world } = ctx;
    if (creature.energy === Infinity) return null;
    if (creature.energy >= creature.maxEnergy * this.threshold) return null;

    const fuel = findClosestOfKind(
      creature.position,
      world.entities,
      EntityKind.Food,
      (e) => {
        return (e as Food).foodType === "fuel";
      },
    );

    if (fuel) {
      return {
        description: "Looking for energy",
        target: fuel,
        targetPos: fuel.position,
      };
    }
    return null;
  }
}

// ── 4. Hunt Behaviour ──

export class HuntBehaviour implements Behaviour {
  priority = 100;
  private preyFilter: (other: Creature, self: Creature) => boolean;

  constructor(preyFilter: (other: Creature, self: Creature) => boolean) {
    this.preyFilter = preyFilter;
  }

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature, world } = ctx;
    if (creature.effectiveDamage <= 0) return null;

    const prey: Creature[] = [];
    for (const e of world.entities) {
      if (!(e instanceof Creature)) continue;
      if (e.health <= 0) continue;
      if (e === creature) continue;
      if (this.preyFilter(e, creature)) {
        const dist = vecDist(creature.position, e.position);
        if (dist <= creature.perceptionRadius) {
          prey.push(e);
        }
      }
    }

    if (prey.length === 0) return null;

    const target = findClosest(creature.position, prey) as Creature;
    return {
      description: `Hunting ${target.species}`,
      target,
      targetPos: target.position,
    };
  }
}

// ── 5. Curious Behaviour (approach any creature) ──

export class CuriousBehaviour implements Behaviour {
  priority = 60;

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature, world } = ctx;
    const targets: Creature[] = [];

    for (const e of world.entities) {
      if (!(e instanceof Creature)) continue;
      if (e.health <= 0) continue;
      if (e === creature) continue;
      const dist = vecDist(creature.position, e.position);
      if (dist <= creature.perceptionRadius) {
        targets.push(e);
      }
    }

    if (targets.length === 0) return null;

    const target = findClosest(creature.position, targets) as Creature;
    // Approach but stop at a "looking" distance
    const dir = vecSub(target.position, creature.position);
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    const lookDist = creature.radius + target.radius + 30;
    const norm = len > 0.001 ? vecNorm(dir) : vec(1, 0);

    // Stop at lookDist
    const targetPos =
      len <= lookDist
        ? creature.position
        : vecAdd(creature.position, vecMul(norm, len - lookDist));

    return {
      description: `Curious about ${target.species}`,
      target,
      targetPos,
    };
  }
}

// ── 6. Defend / Retaliate Behaviour ──

export class DefendBehaviour implements Behaviour {
  priority = 95;

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature } = ctx;
    if (creature.retaliationTimer <= 0) return null;
    if (!creature.lastAttacker || creature.lastAttacker.health <= 0)
      return null;

    return {
      description: `Retaliating against ${creature.lastAttacker.species}`,
      target: creature.lastAttacker,
      targetPos: creature.lastAttacker.position,
    };
  }
}

// ── 7. Help Faction Behaviour ──

export class HelpFactionBehaviour implements Behaviour {
  priority = 70;

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature, world } = ctx;
    // Only help if we have damage or retaliation
    if (creature.damage <= 0 && creature.retaliation <= 0) return null;
    if (!creature.faction) return null;

    // Find faction members that are being attacked (have lastAttacker)
    for (const e of world.entities) {
      if (!(e instanceof Creature)) continue;
      if (e.health <= 0) continue;
      if (e === creature) continue;
      if (e.faction !== creature.faction) continue;
      if (!e.lastAttacker || e.lastAttacker.health <= 0) continue;

      const dist = vecDist(creature.position, e.position);
      if (dist <= creature.perceptionRadius * 1.5) {
        return {
          description: `Helping ${e.species} vs ${e.lastAttacker.species}`,
          target: e.lastAttacker,
          targetPos: e.lastAttacker.position,
        };
      }
    }
    return null;
  }
}

// ── 8. Seek Buff Behaviour ──

export class SeekBuffBehaviour implements Behaviour {
  priority = 65;

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature, world } = ctx;
    const buff = findClosestOfKind(
      creature.position,
      world.entities,
      EntityKind.Buff,
    );
    if (!buff) return null;
    const dist = vecDist(creature.position, buff.position);
    if (dist <= creature.perceptionRadius * 0.6) {
      return {
        description: "Moving to buff",
        target: buff,
        targetPos: buff.position,
      };
    }
    return null;
  }
}

// ── 9. Wander Behaviour (fallback) ──

export class WanderBehaviour implements Behaviour {
  priority = 0;

  evaluate(ctx: BehaviourContext): CreatureAction | null {
    const { creature } = ctx;
    // Return null so the default wander in Creature.update handles it
    // But we provide a position so the navigator has a target
    return {
      description: "Wandering",
      target: null,
      targetPos: creature.position, // stays in place, natural wander in update
    };
  }
}

// ── Behaviour evaluation ──

/**
 * Evaluate behaviours in priority order (highest first).
 * Returns the first non-null action, or null if none applies.
 */
export function evaluateBehaviours(
  behaviours: Behaviour[],
  ctx: BehaviourContext,
): CreatureAction | null {
  // Sort by priority descending
  const sorted = [...behaviours].sort((a, b) => b.priority - a.priority);
  for (const b of sorted) {
    const action = b.evaluate(ctx);
    if (action) return action;
  }
  return null;
}

// ── Pre-built behaviour sets for each species ──

import type { CreatureSpecies } from "../entities/creature";

export function getBehavioursForSpecies(species: CreatureSpecies): Behaviour[] {
  switch (species) {
    case "blob":
      return [
        new FleeBehaviour((other, _self) => other.isAggressive),
        new SeekHealthBehaviour(0.45),
        new SeekEnergyBehaviour(0.35),
        new SeekBuffBehaviour(),
        new WanderBehaviour(),
      ];

    case "floater":
      // Runs from every creature (including own species)
      return [
        new FleeBehaviour(() => true),
        new SeekHealthBehaviour(0.5),
        new SeekEnergyBehaviour(0.4),
        new SeekBuffBehaviour(),
        new WanderBehaviour(),
      ];

    case "crawler":
      return [
        new SeekHealthBehaviour(0.4),
        new SeekEnergyBehaviour(0.3),
        new SeekBuffBehaviour(),
        new CuriousBehaviour(),
        new WanderBehaviour(),
      ];

    case "defender":
      return [
        new DefendBehaviour(),
        new FleeBehaviour((other, _self) => other.isAggressive),
        new HelpFactionBehaviour(),
        new SeekHealthBehaviour(0.45),
        new SeekEnergyBehaviour(0.35),
        new SeekBuffBehaviour(),
        new WanderBehaviour(),
      ];

    case "lurker":
      return [
        new HuntBehaviour(
          (other, self) =>
            other.radius < self.radius && other.species !== self.species,
        ),
        new HelpFactionBehaviour(),
        new SeekHealthBehaviour(0.4),
        new SeekEnergyBehaviour(0.3),
        new SeekBuffBehaviour(),
        new WanderBehaviour(),
      ];

    case "spiker":
      return [
        new HuntBehaviour((other, self) => other.species !== self.species),
        new HelpFactionBehaviour(),
        new SeekHealthBehaviour(0.4),
        new SeekEnergyBehaviour(0.3),
        new SeekBuffBehaviour(),
        new WanderBehaviour(),
      ];

    default:
      return [new WanderBehaviour()];
  }
}
