import type { CreatureSpecies } from "../entities/creature";

// ── Core simulation constants ──
export const ARENA_WIDTH = 5000;
export const ARENA_HEIGHT = 5000;
export const ENERGY_DRAIN_INTERVAL = 10; // seconds per 1 energy
export const STARVATION_DPS = 1; // damage per second when energy = 0

// ── Food & pickups ──
export const FUEL_ENERGY = 30;
export const HEART_HEAL = 20;
export const AGGRESSIVE_HEART_HEAL = 10;
export const KILL_HEAL = 20;

// ── Spawner towers ──
export const SPAWNER_MAX_HP = 5000;
export const SPAWNER_DEFAULT_INTERVAL = 5000; // ms
export const SPAWNER_MIN_INTERVAL = 200; // ms (5 per sec)

// ── Buffs ──
export const BUFF_DURATION = 10; // seconds
export const BUFF_RADIUS = 12;

// ── Species config ──
export interface SpeciesConfig {
  shape: "circle" | "square" | "triangle" | "spiky";
  maxSpeed: number;
  maxHealth: number;
  maxEnergy: number;
  color: string;
  accentColor: string;
  damage: number;
  retaliation: number;
  perceptionRadius: number;
  radius: number;
  isAggressive: boolean;
}

export const SPECIES: Record<CreatureSpecies, SpeciesConfig> = {
  blob: {
    shape: "circle",
    maxSpeed: 60,
    maxHealth: 140,
    maxEnergy: 120,
    color: "#4ade80",
    accentColor: "#22c55e",
    damage: 0,
    retaliation: 0,
    perceptionRadius: 200,
    radius: 15,
    isAggressive: false,
  },
  floater: {
    shape: "circle",
    maxSpeed: 120,
    maxHealth: 60,
    maxEnergy: 80,
    color: "#67e8f9",
    accentColor: "#06b6d4",
    damage: 0,
    retaliation: 0,
    perceptionRadius: 250,
    radius: 10,
    isAggressive: false,
  },
  crawler: {
    shape: "circle",
    maxSpeed: 40,
    maxHealth: 180,
    maxEnergy: 160,
    color: "#fde047",
    accentColor: "#eab308",
    damage: 0,
    retaliation: 0,
    perceptionRadius: 200,
    radius: 18,
    isAggressive: false,
  },
  defender: {
    shape: "square",
    maxSpeed: 70,
    maxHealth: 120,
    maxEnergy: 160,
    color: "#60a5fa",
    accentColor: "#3b82f6",
    damage: 0,
    retaliation: 20,
    perceptionRadius: 220,
    radius: 16,
    isAggressive: false,
  },
  lurker: {
    shape: "triangle",
    maxSpeed: 100,
    maxHealth: 100,
    maxEnergy: 80,
    color: "#c084fc",
    accentColor: "#8b5cf6",
    damage: 15,
    retaliation: 0,
    perceptionRadius: 320,
    radius: 14,
    isAggressive: true,
  },
  spiker: {
    shape: "spiky",
    maxSpeed: 80,
    maxHealth: 100,
    maxEnergy: 100,
    color: "#f87171",
    accentColor: "#ef4444",
    damage: 20,
    retaliation: 0,
    perceptionRadius: 300,
    radius: 13,
    isAggressive: true,
  },
};

// ── Game speeds ──
export const GAME_SPEEDS = [0, 1, 2, 3, 4]; // 0 = paused
export const SPEED_MULTIPLIERS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
};
