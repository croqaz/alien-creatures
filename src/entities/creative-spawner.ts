import { Vec2, vec } from "../utils/vec2";
import { Creature } from "./creature";
import type { World } from "./entity";
import type { Behaviour } from "../behaviours/behaviour";
import { getSpecies, createWithVariant } from "./creatures/registry";

/** The spawner never moves and never acts on its own — its behaviour is a no-op. */
const IDLE_BEHAVIOUR: Behaviour = {
  name: "Creative Spawner",
  decide: () => vec(0, 0),
};

/** Collision footprint of the spawner's base. */
const CREATIVE_RADIUS = 28;

/**
 * One step of a Creative Spawner's program. Both shapes are plain JSON objects
 * (no class instances, no functions) so the whole program serialises straight
 * into the map file and back — see map-io's `creative` entity.
 *
 * - A `round` emits `count` creatures of one `species`, one per second.
 * - A `wait` simply idles for `seconds` before the next step runs.
 */
export interface RoundStep {
  kind: "round";
  /** Species name (must exist in the registry); the brood it emits. */
  species: string;
  /** How many creatures this round spawns, at one per second. */
  count: number;
}
export interface WaitStep {
  kind: "wait";
  /** Seconds to idle before advancing to the next step. */
  seconds: number;
}
export type ProgramStep = RoundStep | WaitStep;

/**
 * A Creative Spawner: an indestructible structure that runs a scripted sequence
 * of "rounds" (spawn N of a species, one per second) and "waits" (idle N
 * seconds). The program is built up in the floating menu, then Start runs it
 * top-to-bottom once and Stop resets it (already-spawned creatures live on).
 *
 * Modelled as a Creature subclass so it reuses placement, selection and the
 * render pipeline, but it's flagged `indestructible` (nothing damages it, no
 * behaviour targets it — see Creature.alliedWith) and fully overrides `update`,
 * so none of the combat/energy/feeding logic in the base class ever runs.
 */
export class CreativeSpawner extends Creature {
  /** The scripted steps, executed in order on Start. Edited live via the UI. */
  program: ProgramStep[] = [];

  /** True while the program is executing. */
  running = false;
  /** Index of the step currently executing (only meaningful while running). */
  stepIndex = 0;
  /** Creatures emitted so far in the current round step. */
  spawnedInStep = 0;

  /** Fixed footprint — immovable, so we re-pin here each frame. */
  private readonly anchor: Vec2;
  /** Seconds of sim time elapsed within the current step. */
  private elapsed = 0;

  constructor(position: Vec2) {
    super(position, {
      species: "Creative Spawner",
      color: "#16998a", // teal — distinct from the colour-borrowing Spawner
      accentColor: "#5fe0cf",
      shape: "rounded-rect", // unused — it has its own renderer
      radius: CREATIVE_RADIUS,
      maxSpeed: 0,
      maxHealth: 1, // irrelevant; the spawner is indestructible
      maxEnergy: Infinity,
      infiniteEnergy: true,
      damage: 0,
      perceptionRadius: 1,
      behaviour: IDLE_BEHAVIOUR,
      faction: "", // factionless, but indestructible so nobody targets it anyway
      canEatFood: false,
      canPickupPowerups: false,
    });
    this.indestructible = true;
    this.anchor = { ...position };
    this.lastActivity = "Idle";
  }

  /** Seconds elapsed within the current step — drives the live progress readout. */
  get stepElapsed(): number {
    return this.elapsed;
  }

  /**
   * Move the spawner to a new fixed location. The Move tool only sets
   * `position`, which `update` would immediately snap back to the anchor — so
   * relocating has to move the anchor as well.
   */
  relocate(pos: Vec2) {
    this.anchor.x = pos.x;
    this.anchor.y = pos.y;
    this.position.x = pos.x;
    this.position.y = pos.y;
  }

  /** Begin executing the program from the top. No-op on an empty program. */
  start() {
    if (this.program.length === 0) return;
    this.running = true;
    this.stepIndex = 0;
    this.spawnedInStep = 0;
    this.elapsed = 0;
  }

  /** Halt and reset the program. Creatures already on the map are left alone. */
  stop() {
    this.running = false;
    this.stepIndex = 0;
    this.spawnedInStep = 0;
    this.elapsed = 0;
  }

  override update(dt: number, world: World) {
    // Immovable and indestructible: re-pin to the anchor (shrug off any shove)
    // and stay at full health no matter what bumped into it this frame.
    this.position.x = this.anchor.x;
    this.position.y = this.anchor.y;
    this.health = this.maxHealth;

    if (!this.running) {
      this.lastActivity = "Idle";
      return;
    }

    const step = this.program[this.stepIndex];
    if (!step) {
      this.stop();
      return;
    }

    if (step.kind === "round") {
      this.runRound(step, dt, world);
    } else {
      this.runWait(step, dt);
    }
  }

  /** Emit one creature per second of elapsed time (the first immediately). */
  private runRound(step: RoundStep, dt: number, world: World) {
    this.lastActivity = `Round: ${step.species} (${this.spawnedInStep}/${step.count})`;
    if (step.count <= 0) {
      this.advance();
      return;
    }
    this.elapsed += dt;
    // Creature i is due at t = i seconds: 0th immediately, then one per second.
    const due = Math.min(step.count, Math.floor(this.elapsed) + 1);
    while (this.spawnedInStep < due) {
      this.emit(step.species, world);
      this.spawnedInStep++;
    }
    if (this.spawnedInStep >= step.count) this.advance();
  }

  /** Idle until the wait's duration elapses, then move on. */
  private runWait(step: WaitStep, dt: number) {
    this.lastActivity = `Waiting ${this.elapsed.toFixed(1)}/${step.seconds}s`;
    this.elapsed += dt;
    if (this.elapsed >= step.seconds) this.advance();
  }

  /** Move to the next step, ending the run (and resetting) past the last one. */
  private advance() {
    this.stepIndex++;
    this.spawnedInStep = 0;
    this.elapsed = 0;
    if (this.stepIndex >= this.program.length) this.stop();
  }

  /** Drop one creature of `speciesName` just outside the spawner. */
  private emit(speciesName: string, world: World) {
    const def = getSpecies(speciesName);
    if (!def) return;
    // Roll the usual Elite/Archer/Healer variants, like every other spawn route.
    const creature = createWithVariant(def, { ...this.position });
    const brood = creature.radius;
    const gap = this.radius + brood + 4;
    const margin = brood;
    // Try a few directions so a wall on one side doesn't stall the round.
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const pos = vec(
        this.position.x + Math.cos(angle) * gap,
        this.position.y + Math.sin(angle) * gap,
      );
      if (pos.x < margin || pos.y < margin) continue;
      if (pos.x > world.arenaWidth - margin) continue;
      if (pos.y > world.arenaHeight - margin) continue;
      if (world.walls.overlaps(pos, brood)) continue;
      creature.position = pos;
      world.spawn(creature);
      return;
    }
    // Boxed in on every side — drop it adjacent anyway rather than skip a spawn.
    creature.position = vec(this.position.x + gap, this.position.y);
    world.spawn(creature);
  }
}
