import type { Game } from "./game";
import { Creature } from "../entities/creature";
import { Spawner } from "../entities/spawner";
import {
  CreativeSpawner,
  type ProgramStep,
} from "../entities/creative-spawner";
import { Food } from "../entities/food";
import { Heart } from "../entities/heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "../entities/powerup";
import { WALL_SIZE } from "../entities/wall";
import { getSpecies } from "../entities/creatures/registry";

/**
 * Save/load for the whole map — walls, spawners, power-ups, food, hearts and
 * creatures — as a self-contained JSON document.
 *
 * Creatures are stored by *species* plus their mutable state (position,
 * velocity, health, energy, variant flags, active boosts). On load each is
 * rebuilt from the registry's species factory and then patched with the saved
 * state, so all the fixed config (colour, shape, stats, behaviour) comes back
 * for free and never has to live in the file. Transient projectiles (fireballs,
 * arrows) and the spatial grid are intentionally not saved.
 */

// v2 adds the "creative" entity (Creative Spawner with its scripted program).
// v1 files still load — they simply contain none.
export const MAP_FORMAT_VERSION = 2;

interface Vec2J {
  x: number;
  y: number;
}

interface BoostsJ {
  shieldMs: number;
  speedMs: number;
  speedMult: number;
  swordMs: number;
  swordMult: number;
}

interface CreatureJ {
  kind: "creature";
  species: string;
  pos: Vec2J;
  vel: Vec2J;
  health: number;
  energy: number;
  isElite: boolean;
  isArcher: boolean;
  isHealer: boolean;
  lastActivity: string;
  boosts: BoostsJ;
}

interface SpawnerJ {
  kind: "spawner";
  /** Brood species the tower emits (not the tower's own decorated name). */
  species: string;
  pos: Vec2J;
  rate: number;
}

interface CreativeSpawnerJ {
  kind: "creative";
  pos: Vec2J;
  /** The scripted rounds/waits, in order. Run state is intentionally not saved. */
  program: ProgramStep[];
}

interface FoodJ {
  kind: "food";
  pos: Vec2J;
  nutrition: number;
  color: string;
}

interface HeartJ {
  kind: "heart";
  pos: Vec2J;
  healing: number;
  color: string;
}

interface ShieldJ {
  kind: "shield";
  pos: Vec2J;
  duration: number;
  color: string;
}

interface SpeedJ {
  kind: "speed";
  pos: Vec2J;
  multiplier: number;
  duration: number;
  color: string;
}

interface SwordJ {
  kind: "sword";
  pos: Vec2J;
  multiplier: number;
  duration: number;
  color: string;
}

type EntityJ =
  | CreatureJ
  | SpawnerJ
  | CreativeSpawnerJ
  | FoodJ
  | HeartJ
  | ShieldJ
  | SpeedJ
  | SwordJ;

interface MapFile {
  version: number;
  exportedAt: string;
  arena: { width: number; height: number };
  time: number;
  walls: { cx: number; cy: number }[];
  entities: EntityJ[];
}

function v(p: Vec2J): Vec2J {
  return { x: p.x, y: p.y };
}

/** Serialise the whole live map to a pretty-printed JSON string. */
export function serializeMap(game: Game): string {
  const entities: EntityJ[] = [];

  for (const e of game.entities) {
    // CreativeSpawner and Spawner both extend Creature, so test them first.
    if (e instanceof CreativeSpawner) {
      if (!e.isAlive) continue;
      entities.push({
        kind: "creative",
        pos: v(e.position),
        // Deep-copy each plain step so the file owns its data, not the live spawner.
        program: e.program.map((s) => ({ ...s })),
      });
    } else if (e instanceof Spawner) {
      if (!e.isAlive) continue;
      entities.push({
        kind: "spawner",
        species: e.spawnSpecies.name,
        pos: v(e.position),
        rate: e.spawnRate,
      });
    } else if (e instanceof Creature) {
      if (!e.isAlive) continue; // skip fading corpses
      entities.push({
        kind: "creature",
        species: e.species,
        pos: v(e.position),
        vel: v(e.velocity),
        health: e.health,
        energy: e.energy,
        isElite: e.isElite,
        isArcher: e.isArcher,
        isHealer: e.isHealer,
        lastActivity: e.lastActivity,
        boosts: e.captureBoosts(),
      });
    } else if (e instanceof Food) {
      entities.push({
        kind: "food",
        pos: v(e.position),
        nutrition: e.nutrition,
        color: e.color,
      });
    } else if (e instanceof Heart) {
      entities.push({
        kind: "heart",
        pos: v(e.position),
        healing: e.healing,
        color: e.color,
      });
    } else if (e instanceof ShieldPowerup) {
      entities.push({
        kind: "shield",
        pos: v(e.position),
        duration: e.duration,
        color: e.color,
      });
    } else if (e instanceof SpeedPowerup) {
      entities.push({
        kind: "speed",
        pos: v(e.position),
        multiplier: e.multiplier,
        duration: e.duration,
        color: e.color,
      });
    } else if (e instanceof SwordPowerup) {
      entities.push({
        kind: "sword",
        pos: v(e.position),
        multiplier: e.multiplier,
        duration: e.duration,
        color: e.color,
      });
    }
    // Anything else (fireballs, arrows) is transient and skipped.
  }

  const file: MapFile = {
    version: MAP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    arena: { width: game.arenaWidth, height: game.arenaHeight },
    time: game.time,
    walls: game.walls.all().map((w) => ({ cx: w.cx, cy: w.cy })),
    entities,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Replace the entire map with the contents of a previously exported JSON
 * string. Wipes the current map first, so callers should confirm with the user
 * beforehand if there's anything worth keeping. Throws on malformed input
 * (the caller still has its untouched map, since clearing happens only after
 * the document parses and validates).
 */
export function deserializeMap(game: Game, json: string): void {
  let file: MapFile;
  try {
    file = JSON.parse(json) as MapFile;
  } catch {
    throw new Error("not valid JSON");
  }
  if (!file || typeof file !== "object") {
    throw new Error("not a map file");
  }
  // Older versions load fine (each new version is purely additive); only a
  // newer-than-known file is rejected.
  if (typeof file.version !== "number" || file.version > MAP_FORMAT_VERSION) {
    throw new Error(
      `unsupported map version ${file.version} (this build reads up to ${MAP_FORMAT_VERSION})`,
    );
  }
  if (!Array.isArray(file.entities) || !Array.isArray(file.walls)) {
    throw new Error("missing entities or walls");
  }

  game.clear();
  game.time = typeof file.time === "number" ? file.time : 0;

  for (const w of file.walls) {
    // placeAt takes a world position and snaps it to the tile, so aim at the
    // cell centre to land back in cell (cx, cy).
    game.walls.placeAt({
      x: w.cx * WALL_SIZE + WALL_SIZE / 2,
      y: w.cy * WALL_SIZE + WALL_SIZE / 2,
    });
  }

  for (const ent of file.entities) {
    switch (ent.kind) {
      case "creature":
        restoreCreature(game, ent);
        break;
      case "spawner": {
        const def = getSpecies(ent.species);
        if (!def) break; // unknown species — skip rather than abort the load
        game.addEntity(new Spawner(v(ent.pos), def, ent.rate));
        break;
      }
      case "creative": {
        const cs = new CreativeSpawner(v(ent.pos));
        cs.program = sanitizeProgram(ent.program);
        game.addEntity(cs);
        break;
      }
      case "food":
        game.addEntity(new Food(v(ent.pos), ent.nutrition, ent.color));
        break;
      case "heart":
        game.addEntity(new Heart(v(ent.pos), ent.healing, ent.color));
        break;
      case "shield":
        game.addEntity(new ShieldPowerup(v(ent.pos), ent.duration, ent.color));
        break;
      case "speed":
        game.addEntity(
          new SpeedPowerup(v(ent.pos), ent.multiplier, ent.duration, ent.color),
        );
        break;
      case "sword":
        game.addEntity(
          new SwordPowerup(v(ent.pos), ent.multiplier, ent.duration, ent.color),
        );
        break;
    }
  }
}

/**
 * Coerce an untrusted program array from a file into well-formed steps,
 * dropping anything malformed (bad kind, unknown species, non-finite numbers)
 * rather than letting a hand-edited file crash the spawner at runtime.
 */
function sanitizeProgram(raw: unknown): ProgramStep[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const step = s as Record<string, unknown>;
    if (step.kind === "round") {
      if (typeof step.species !== "string" || !getSpecies(step.species))
        continue;
      const count = Math.floor(Number(step.count));
      if (!Number.isFinite(count) || count < 1) continue;
      out.push({ kind: "round", species: step.species, count });
    } else if (step.kind === "wait") {
      const seconds = Number(step.seconds);
      if (!Number.isFinite(seconds) || seconds < 0) continue;
      out.push({ kind: "wait", seconds });
    }
  }
  return out;
}

function restoreCreature(game: Game, ent: CreatureJ): void {
  const def = getSpecies(ent.species);
  if (!def) return; // unknown species — skip

  const c = def.create(v(ent.pos));
  // Re-apply the variant first so derived stats (elite multipliers, healer's
  // zeroed damage) are in place before we overwrite the live health/energy.
  if (ent.isElite) c.makeElite();
  else if (ent.isArcher) c.makeArcher();
  else if (ent.isHealer) c.makeHealer();

  c.velocity = v(ent.vel);
  c.health = ent.health;
  c.energy = ent.energy;
  c.lastActivity = ent.lastActivity ?? c.lastActivity;

  const b = ent.boosts;
  if (b) {
    if (b.shieldMs > 0) c.applyShield(b.shieldMs);
    if (b.speedMs > 0) c.applySpeed(b.speedMult, b.speedMs);
    if (b.swordMs > 0 && c.canWieldSword) c.applySword(b.swordMult, b.swordMs);
  }

  game.addEntity(c);
}
