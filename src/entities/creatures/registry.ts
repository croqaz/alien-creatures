import { Vec2 } from "../../utils/vec2";
import { Creature } from "../creature";
import { GrazerBehaviour } from "../../behaviours/grazer";
import { ShyBehaviour } from "../../behaviours/shy";
import { CuriousBehaviour } from "../../behaviours/curious";
import { AggressiveBehaviour } from "../../behaviours/aggressive";
import { PredatorBehaviour } from "../../behaviours/predator";
import { DefenderBehaviour } from "../../behaviours/defender";
import { BossBehaviour } from "../../behaviours/boss";
import { ChargerBehaviour, TELEPORT_RANGE } from "../../behaviours/charger";
import { CatapultBehaviour } from "../../behaviours/catapult";
import { ShardBossBehaviour } from "../../behaviours/shard-boss";
import { TrapBehaviour } from "../../behaviours/trap";

/**
 * Allegiance groups shared across species (see `Creature.faction`). Members of
 * the same faction never harm one another and rush to each other's aid in a
 * fight. The predators (Spiker, Lurker) hunt as a pack; the peaceful grazers
 * (Blob, Floater, Crawler, Defender) look out for one another. The boss and its
 * minions keep their own `VOID_FACTION`.
 */
export const PREDATOR_FACTION = "predator";
export const PEACEFUL_FACTION = "peaceful";
/** Shared allegiance of the bosses and everything they summon. Members never
 * harm one another; everyone outside the faction is fair game. */
export const VOID_FACTION = "void";

export interface SpeciesDef {
  name: string;
  description: string;
  create(position: Vec2): Creature;
  /**
   * Whether this species can spawn as a rare Elite variant. Defaults to true.
   * Bosses and boss minions opt out — they're already special and never elite.
   */
  canBeElite?: boolean;
  /**
   * Whether this species can spawn as a rare Archer variant. Defaults to true,
   * but only creatures that can actually fight (deal damage or retaliate) ever
   * become archers. Bosses opt out — they have their own attacks.
   */
  canBeArcher?: boolean;
  /**
   * Whether this species can spawn as a rare Healer variant. Defaults to true —
   * any creature can be a Healer (even a predator, which then deals no damage).
   * Bosses opt out — they're already special.
   */
  canBeHealer?: boolean;
  /**
   * Whether a Creature Spawner tower may produce this species. Defaults to true.
   * Bosses opt out — they're one-of-a-kind, not something a tower churns out.
   */
  canSpawn?: boolean;
}

/**
 * Probability that an eligible spawn comes out as a rare Elite. Roughly "once
 * every 20 spawns". Elites are never selectable directly — they only appear
 * through this automatic roll, whether spawned from the panel or by a tower.
 */
export const ELITE_SPAWN_CHANCE = 1 / 20;

/**
 * Probability that an eligible spawn comes out as an Archer — roughly "once
 * every 5 spawns". A creature is at most one of Elite or Archer (Elite is rarer
 * and wins the roll), and only fighters (damage or retaliation > 0) qualify.
 */
export const ARCHER_SPAWN_CHANCE = 1 / 10;

/**
 * Probability that an eligible spawn comes out as a Healer — roughly "once every
 * 5 spawns", same as an Archer. Any species qualifies (a Healer deals no damage
 * regardless of what it was), and like the others it's mutually exclusive with
 * Elite and Archer.
 */
export const HEALER_SPAWN_CHANCE = 1 / 10;

/**
 * Build a creature of `species` at `position`, applying the rare automatic
 * variant promotions. Shared by every spawn route (panel buttons, click-to-place,
 * and Creature Spawner towers) so variants arise identically everywhere. A
 * creature takes at most one special form — Elite, Archer, or Healer: the rarer
 * Elite roll comes first, then Archer, then Healer, each only if the prior
 * missed. Species opt out via canBeElite / canBeArcher / canBeHealer === false.
 */
export function createWithVariant(
  species: SpeciesDef,
  position: Vec2,
): Creature {
  const creature = species.create(position);
  if (species.canBeElite !== false && Math.random() < ELITE_SPAWN_CHANCE) {
    creature.makeElite();
  } else if (
    species.canBeArcher !== false &&
    creature.canWieldSword && // only genuine fighters take up the bow
    Math.random() < ARCHER_SPAWN_CHANCE
  ) {
    creature.makeArcher();
  } else if (
    species.canBeHealer !== false &&
    Math.random() < HEALER_SPAWN_CHANCE
  ) {
    creature.makeHealer();
  }
  return creature;
}

/**
 * A Void Spiker: the boss's loyal minion — a fast, aggressive black spiker that
 * attacks every creature outside the void faction. Exposed as a standalone
 * factory (as well as the registry entry below) so the boss behaviour can summon
 * them mid-fight without routing through the variant-roll spawn path.
 */
export function createVoidSpiker(pos: Vec2): Creature {
  return new Creature(pos, {
    species: "Void Spiker",
    color: "#16161f",
    accentColor: "#a33",
    shape: "spiked",
    radius: 15,
    maxSpeed: 95,
    maxHealth: 120,
    maxEnergy: 100,
    damage: 30,
    perceptionRadius: 300,
    behaviour: new AggressiveBehaviour(),
    faction: VOID_FACTION,
  });
}

/**
 * A Death Shardling: the Shard of Death's loyal minion — a small, fast crystal
 * splinter that attacks every creature outside the void faction. Exposed as a
 * standalone factory (as well as the registry entry below) so the boss behaviour
 * can summon them mid-fight without routing through the variant-roll spawn path.
 */
export function createDeathShardling(pos: Vec2): Creature {
  return new Creature(pos, {
    species: "Death Shardling",
    color: "#b9263f", // crystalline crimson
    accentColor: "#ff6f8a",
    shape: "crystal",
    radius: 14,
    maxSpeed: 100,
    maxHealth: 110,
    maxEnergy: 100,
    damage: 28,
    perceptionRadius: 320,
    behaviour: new AggressiveBehaviour(),
    faction: VOID_FACTION,
  });
}

const speciesList: SpeciesDef[] = [
  {
    name: "Blob",
    description: "Peaceful grazer, slow and green",
    create(pos) {
      return new Creature(pos, {
        species: "Blob",
        color: "#4a4",
        accentColor: "#6d6",
        shape: "circle",
        radius: 16,
        maxSpeed: 60,
        maxHealth: 140,
        maxEnergy: 120,
        damage: 0,
        perceptionRadius: 180,
        behaviour: new GrazerBehaviour(),
        faction: PEACEFUL_FACTION,
      });
    },
  },
  {
    name: "Spiker",
    description: "Aggressive, chases and attacks others",
    create(pos) {
      return new Creature(pos, {
        species: "Spiker",
        color: "#c44",
        accentColor: "#f86",
        shape: "spiked",
        radius: 15,
        maxSpeed: 80,
        maxHealth: 100,
        maxEnergy: 100,
        damage: 25,
        perceptionRadius: 250,
        behaviour: new AggressiveBehaviour(),
        faction: PREDATOR_FACTION,
      });
    },
  },
  {
    name: "Floater",
    description: "Shy and fast, flees from danger",
    create(pos) {
      return new Creature(pos, {
        species: "Floater",
        color: "#6af",
        accentColor: "#9cf",
        shape: "oval",
        radius: 10,
        maxSpeed: 120,
        maxHealth: 60,
        maxEnergy: 80,
        damage: 0,
        perceptionRadius: 200,
        behaviour: new ShyBehaviour(),
        faction: PEACEFUL_FACTION,
      });
    },
  },
  {
    name: "Crawler",
    description: "Large and curious, inspects everything",
    create(pos) {
      return new Creature(pos, {
        species: "Crawler",
        color: "#a87",
        accentColor: "#cb9",
        shape: "rounded-rect",
        radius: 22,
        maxSpeed: 45,
        maxHealth: 180,
        maxEnergy: 160,
        damage: 0,
        retaliation: 10,
        perceptionRadius: 200,
        behaviour: new CuriousBehaviour(),
        faction: PEACEFUL_FACTION,
      });
    },
  },
  {
    name: "Lurker",
    description: "Stealthy predator, hunts smaller prey",
    create(pos) {
      return new Creature(pos, {
        species: "Lurker",
        color: "#639",
        accentColor: "#96c",
        shape: "triangle",
        radius: 14,
        maxSpeed: 90,
        maxHealth: 100,
        maxEnergy: 90,
        damage: 35,
        perceptionRadius: 300,
        behaviour: new PredatorBehaviour(),
        faction: PREDATOR_FACTION,
      });
    },
  },
  {
    name: "Defender",
    description: "Peaceful grazer that fights back when attacked",
    create(pos) {
      return new Creature(pos, {
        species: "Defender",
        color: "#f80",
        accentColor: "#fc6",
        shape: "pentagon",
        radius: 16,
        maxSpeed: 70,
        maxHealth: 120,
        maxEnergy: 140,
        damage: 0,
        retaliation: 30,
        perceptionRadius: 200,
        behaviour: new DefenderBehaviour(),
        faction: PEACEFUL_FACTION,
      });
    },
  },
  {
    name: "Void Spiker",
    description:
      "Loyal minion of the boss — fast, aggressive, attacks all outsiders",
    create: createVoidSpiker,
    canBeElite: true, // boss minion
  },
  {
    name: "Trap",
    description:
      "Void ambusher — lies still baiting food in its toothy maw, then snaps and chases the unwary",
    create(pos) {
      return new Creature(pos, {
        species: "Trap",
        color: "#80808a", // dull grey
        accentColor: "#3c3c44",
        shape: "trap",
        radius: 22, // a Crawler's bulk
        maxSpeed: 45, // chases as fast as a Crawler
        maxHealth: 160,
        maxEnergy: 100,
        infiniteEnergy: true, // lies in wait indefinitely — never starves
        damage: 0, // looks harmless; TrapBehaviour bites directly when it springs
        perceptionRadius: 360, // sees far enough to chase, but only snaps up close
        behaviour: new TrapBehaviour(),
        faction: VOID_FACTION,
        canEatFood: false, // never devours its own bait
      });
    },
    // A special ambusher whose bite is a fixed burst, not its `damage` stat —
    // the variant rolls (Elite/Archer/Healer) don't apply, so opt out.
    canBeElite: false,
    canBeArcher: false,
    canBeHealer: false,
  },
  {
    name: "Death Shardling",
    description:
      "Loyal minion of the Shard of Death — a fast crystal splinter that attacks all outsiders",
    create: createDeathShardling,
    canBeElite: true, // boss minion
  },
  {
    name: "Voidspike Boss",
    description:
      "Colossal black spiker — infinite energy, fireballs, summons spikers at half health",
    create(pos) {
      return new Creature(pos, {
        species: "Voidspike Boss",
        color: "#0a0a12",
        accentColor: "#922",
        shape: "spiked",
        radius: 160, // 10× a Blob
        maxSpeed: 55,
        maxHealth: 30000,
        maxEnergy: Infinity,
        infiniteEnergy: true,
        damage: 125,
        perceptionRadius: 900,
        behaviour: new BossBehaviour(),
        faction: VOID_FACTION,
        canEatFood: false, // cannot feed, but still heals from hearts
        canPickupPowerups: false, // immune to every power-up
      });
    },
    canBeElite: false, // bosses are never elite
    canBeArcher: false, // nor archers — they have their own attacks
    canBeHealer: false, // nor healers — they're already special
    canSpawn: false, // and never produced by a spawner tower
  },
  {
    name: "Charger",
    description:
      "Colossal orange Lurker — infinite energy, brutal melee, teleports across half the map to its prey",
    create(pos) {
      return new Creature(pos, {
        species: "Charger",
        color: "#e67300", // orange
        accentColor: "#ffa64d", // lighter orange
        shape: "triangle", // a Lurker, scaled up
        radius: 84, // 6× a Lurker (14)
        maxSpeed: 90,
        maxHealth: 23000,
        maxEnergy: Infinity,
        infiniteEnergy: true,
        damage: 160,
        perceptionRadius: TELEPORT_RANGE, // hunts prey across half the map
        behaviour: new ChargerBehaviour(),
        faction: VOID_FACTION,
        canEatFood: false, // cannot feed, but still heals from hearts
        canPickupPowerups: false, // immune to every power-up
      });
    },
    canBeElite: false, // bosses are never elite
    canBeArcher: false, // nor archers — they have their own attacks
    canBeHealer: false, // nor healers — they're already special
    canSpawn: false, // and never produced by a spawner tower
  },
  {
    name: "Catapult",
    description:
      "Colossal purple Lurker — infinite energy, lobs fireballs like the Voidspike Boss, no melee",
    create(pos) {
      return new Creature(pos, {
        species: "Catapult",
        color: "#7a2bd6", // purple
        accentColor: "#b07cf0", // lighter purple
        shape: "triangle", // a Lurker, scaled up
        radius: 84, // 6× a Lurker (14)
        maxSpeed: 55,
        maxHealth: 20000,
        maxEnergy: Infinity,
        infiniteEnergy: true,
        damage: 0, // pure artillery — no contact damage
        perceptionRadius: 900,
        behaviour: new CatapultBehaviour(),
        faction: VOID_FACTION,
        canEatFood: false, // cannot feed, but still heals from hearts
        canPickupPowerups: false, // immune to every power-up
      });
    },
    canBeElite: false, // bosses are never elite
    canBeArcher: false, // nor archers — they have their own attacks
    canBeHealer: false, // nor healers — they're already special
    canSpawn: false, // and never produced by a spawner tower
  },
  {
    name: "Shard of Death",
    description:
      "Colossal crystal sheathed in three crusts — no melee, fires lasers and knock-back shockwaves, summons shardlings at half health",
    create(pos) {
      return new Creature(pos, {
        species: "Shard of Death",
        color: "#3d006e", // pale icy crystal
        accentColor: "#d6005a", // deep crimson edges
        shape: "crystal",
        radius: 160, // bare core — same as the Voidspike Boss
        maxSpeed: 45,
        maxHealth: 50000,
        maxEnergy: Infinity,
        infiniteEnergy: true,
        damage: 0, // no melee — fights purely at range
        perceptionRadius: 950,
        behaviour: new ShardBossBehaviour(),
        faction: VOID_FACTION,
        canEatFood: false, // cannot feed, but still heals from hearts
        canPickupPowerups: false, // immune to every power-up
        // Three concentric crusts (10k HP each). Their thicknesses sum to 160,
        // so the armoured boss is 320 across — twice the bare core — and shrinks
        // a third each time a crust shatters.
        crusts: [
          { hp: 10000, thickness: 52 }, // outermost
          { hp: 10000, thickness: 53 },
          { hp: 10000, thickness: 54 }, // innermost
        ],
      });
    },
    canBeElite: false, // bosses are never elite
    canBeArcher: false, // nor archers — they have their own attacks
    canBeHealer: false, // nor healers — they're already special
    canSpawn: false, // and never produced by a spawner tower
  },
];

export function getSpeciesList(): SpeciesDef[] {
  return speciesList;
}

export function getSpecies(name: string): SpeciesDef | undefined {
  return speciesList.find((s) => s.name === name);
}
