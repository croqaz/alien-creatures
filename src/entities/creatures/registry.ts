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
import { createVoidSpiker, VOID_FACTION } from "./void-spiker";

/**
 * Allegiance groups shared across species (see `Creature.faction`). Members of
 * the same faction never harm one another and rush to each other's aid in a
 * fight. The predators (Spiker, Lurker) hunt as a pack; the peaceful grazers
 * (Blob, Floater, Crawler, Defender) look out for one another. The boss and its
 * minions keep their own `VOID_FACTION`.
 */
export const PREDATOR_FACTION = "predator";
export const PEACEFUL_FACTION = "peaceful";

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
 * Build a creature of `species` at `position`, applying the rare automatic
 * Elite promotion. Shared by every spawn route (panel buttons, click-to-place,
 * and Creature Spawner towers) so elites arise identically everywhere — and
 * never for a species that opts out via canBeElite === false.
 */
export function createWithElite(species: SpeciesDef, position: Vec2): Creature {
  const creature = species.create(position);
  if (species.canBeElite !== false && Math.random() < ELITE_SPAWN_CHANCE) {
    creature.makeElite();
  }
  return creature;
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
        maxHealth: 19000,
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
        maxHealth: 15000,
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
        maxHealth: 12000,
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
    canSpawn: false, // and never produced by a spawner tower
  },
];

export function getSpeciesList(): SpeciesDef[] {
  return speciesList;
}

export function getSpecies(name: string): SpeciesDef | undefined {
  return speciesList.find((s) => s.name === name);
}
