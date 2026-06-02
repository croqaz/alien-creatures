import { Vec2 } from "../../utils/vec2";
import { Creature } from "../creature";
import { GrazerBehaviour } from "../../behaviours/grazer";
import { ShyBehaviour } from "../../behaviours/shy";
import { CuriousBehaviour } from "../../behaviours/curious";
import { AggressiveBehaviour } from "../../behaviours/aggressive";
import { PredatorBehaviour } from "../../behaviours/predator";

export interface SpeciesDef {
  name: string;
  description: string;
  create(position: Vec2): Creature;
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
        maxHealth: 100,
        maxEnergy: 120,
        damage: 0,
        perceptionRadius: 180,
        behaviour: new GrazerBehaviour(),
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
        maxHealth: 120,
        maxEnergy: 100,
        damage: 25,
        perceptionRadius: 250,
        behaviour: new AggressiveBehaviour(),
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
        maxSpeed: 110,
        maxHealth: 60,
        maxEnergy: 80,
        damage: 0,
        perceptionRadius: 200,
        behaviour: new ShyBehaviour(),
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
        maxEnergy: 150,
        damage: 0,
        perceptionRadius: 200,
        behaviour: new CuriousBehaviour(),
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
      });
    },
  },
];

export function getSpeciesList(): SpeciesDef[] {
  return speciesList;
}

export function getSpecies(name: string): SpeciesDef | undefined {
  return speciesList.find((s) => s.name === name);
}
