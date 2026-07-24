import type { Game } from "./game";
import { Creature } from "../entities/creature";
import { Spawner } from "../entities/spawner";
import {
  CreativeSpawner,
  type ProgramStep,
} from "../entities/creative-spawner";
import { Food } from "../entities/food";
import { TrapLure } from "../entities/trap-lure";
import { Heart } from "../entities/heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "../entities/powerup";
import { blockMaxHp, type BlockType, WALL_SIZE } from "../entities/wall";
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
// v3 gives every wall a block type (stone/dirt) and health. v1/v2 walls had
// neither — they load as full-health stone (the old impassable wall). Older
// files still load; each new version is purely additive.
export const MAP_FORMAT_VERSION = 3;

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

interface WallJ {
  cx: number;
  cy: number;
  /** Absent in v1/v2 files — those walls load as stone. */
  type?: BlockType;
  /** Current health; absent means full (so undamaged blocks stay compact in the file). */
  hp?: number;
}

interface MapFile {
  version: number;
  exportedAt: string;
  arena: { width: number; height: number };
  time: number;
  walls: WallJ[];
  entities: EntityJ[];
}

function v(p: Vec2J): Vec2J {
  return { x: p.x, y: p.y };
}

/** Serialise the whole live map to a pretty-printed JSON string. */
export function serializeMap(game: Game): string {
  const entities: EntityJ[] = [];

  for (const e of game.entities) {
    // A Trap's bait is owned and transient: it's re-created by the Trap on load,
    // so persisting it would leave a stray static morsel behind. Skip it (it's a
    // Food subclass, so this must come before the Food branch below).
    if (e instanceof TrapLure) continue;
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
    // Persist each block's type, plus its health only when it's been dug into
    // (full-health blocks stay compact — most of a map is undamaged stone).
    walls: game.walls.all().map((w) => ({
      cx: w.cx,
      cy: w.cy,
      type: w.type,
      ...(w.hp < w.maxHp ? { hp: w.hp } : {}),
    })),
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("not valid JSON");
  }
  loadMapDocument(game, parsed);
}

/**
 * Load an already-parsed map document (from a file, or a bundled template) into
 * the game. Same validation and restore semantics as deserializeMap; kept
 * separate so templates can pass their imported JSON object directly without a
 * stringify/parse round-trip. Throws on malformed input before touching the map.
 */
export function loadMapDocument(game: Game, doc: unknown): void {
  const file = doc as MapFile;
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

  // Restore the arena dimensions so a map saved at any size — a built-in
  // size/shape or a hand-tweaked custom one — comes back at exactly its
  // original proportions. Files without a valid arena block (older exports)
  // keep the current arena size.
  const arena = file.arena;
  if (
    arena &&
    typeof arena.width === "number" &&
    typeof arena.height === "number" &&
    arena.width > 0 &&
    arena.height > 0
  ) {
    game.resizeArena(arena.width, arena.height);
  }

  game.time = typeof file.time === "number" ? file.time : 0;

  for (const w of file.walls) {
    // placeAt takes a world position and snaps it to the tile, so aim at the
    // cell centre to land back in cell (cx, cy). A missing type (v1/v2 file)
    // means a classic impassable wall — now a full-health stone block. A saved
    // hp restores a partly-dug block; clamp it to the type's max.
    const type: BlockType = w.type === "dirt" ? "dirt" : "stone";
    const hp =
      typeof w.hp === "number"
        ? Math.max(1, Math.min(w.hp, blockMaxHp(type)))
        : undefined;
    game.walls.placeAt(
      {
        x: w.cx * WALL_SIZE + WALL_SIZE / 2,
        y: w.cy * WALL_SIZE + WALL_SIZE / 2,
      },
      type,
      hp,
    );
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
      if (typeof step.species !== "string" || !getSpecies(step.species)) {
        continue;
      }
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
