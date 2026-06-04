import { Vec2, vec } from "../utils/vec2";
import { Creature } from "./creature";
import type { World } from "./entity";
import type { Behaviour } from "../behaviours/behaviour";
import { type SpeciesDef, createWithElite } from "./creatures/registry";

/** The tower never moves and never acts on its own — its behaviour is a no-op. */
const IDLE_BEHAVIOUR: Behaviour = {
  name: "Spawner",
  decide: () => vec(0, 0),
};

/** Hit points a spawner tower absorbs before it's destroyed. */
const SPAWNER_HEALTH = 5500;
/** Collision footprint of the tower's base. */
const SPAWNER_RADIUS = 26;

/**
 * A Creature Spawner: a tall, immovable tower that periodically emits creatures
 * of one species in every direction around it. Modelled as a Creature subclass
 * so it slots straight into the existing combat — any creature that deals
 * contact damage can grind it down, it shows a health bar, and faction rules
 * apply (its own brood won't tear it apart) — without touching the combat code.
 * It never moves, never tires (infinite energy, like the boss), and deals no
 * contact damage itself. A bespoke renderer draws it as a glowing tower.
 */
export class Spawner extends Creature {
  /** The species this tower churns out. */
  readonly spawnSpecies: SpeciesDef;
  /** Creatures produced per second (1–10), chosen when the tower is placed. */
  spawnRate: number;
  /** Fixed footprint — the tower is immovable, so we re-pin here each frame. */
  private readonly anchor: Vec2;
  /** Carries fractional spawn progress between frames. */
  private spawnAccumulator = 0;
  /** Body radius of the creature we emit, used to clear it off the tower. */
  private readonly broodRadius: number;

  constructor(position: Vec2, species: SpeciesDef, spawnRate: number) {
    // Borrow the look of the creature we spawn so the tower glows its colour.
    const sample = species.create(position);
    super(position, {
      species: `${species.name} Spawner`,
      color: sample.color,
      accentColor: sample.accentColor,
      shape: "rounded-rect", // unused — Spawner has its own renderer
      radius: SPAWNER_RADIUS,
      maxSpeed: 0,
      maxHealth: SPAWNER_HEALTH,
      maxEnergy: Infinity,
      infiniteEnergy: true, // never tires, never starves (like the boss)
      damage: 0, // the tower itself deals no contact damage
      perceptionRadius: 1,
      behaviour: IDLE_BEHAVIOUR,
      // Inherit the brood's faction so a factioned brood (e.g. Void Spikers)
      // stays loyal and won't tear its own tower down. Factionless creatures
      // have no allegiance, so they'll happily attack it — as intended.
      faction: sample.faction,
      canEatFood: false,
      canPickupPowerups: false,
    });
    this.spawnSpecies = species;
    this.spawnRate = spawnRate;
    this.anchor = { ...position };
    this.broodRadius = sample.radius;
    this.lastActivity = `Spawning ${species.name}`;
  }

  override update(dt: number, world: World) {
    if (!this.isAlive) return;

    // Immovable: shrug off any shove from creatures bumping into the tower.
    this.position.x = this.anchor.x;
    this.position.y = this.anchor.y;

    // Destroyed once attackers grind its health to zero.
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.deathTime = performance.now();
      return;
    }

    // Emit at the configured rate, carrying fractional progress so a rate like
    // 3/s spaces creatures evenly rather than bursting all at once each second.
    this.spawnAccumulator += dt * this.spawnRate;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.emit(world);
    }
  }

  /** Drop one creature just outside the tower in a random direction. */
  private emit(world: World) {
    const gap = this.radius + this.broodRadius + 4;
    const margin = this.broodRadius;
    // Try a few random directions so a wall on one side doesn't stall spawning.
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const pos = vec(
        this.position.x + Math.cos(angle) * gap,
        this.position.y + Math.sin(angle) * gap,
      );
      if (pos.x < margin || pos.y < margin) continue;
      if (pos.x > world.arenaWidth - margin) continue;
      if (pos.y > world.arenaHeight - margin) continue;
      if (world.walls.overlaps(pos, this.broodRadius)) continue;
      // Elites roll exactly as they do for any other spawn.
      world.spawn(createWithElite(this.spawnSpecies, pos));
      return;
    }
  }
}
