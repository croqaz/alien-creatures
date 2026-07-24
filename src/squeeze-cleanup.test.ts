import { describe, expect, it } from "vitest";
import { Creature } from "./entities/creature";
import { Entity, World } from "./entities/entity";
import { WallGrid } from "./entities/wall";

// ---------------------------------------------------------------------------
// Mock world that wraps a list of entities and tracks spawned entities.
// ---------------------------------------------------------------------------
class MockWorld implements World {
  entities: Entity[];
  walls = new WallGrid();
  arenaWidth: number;
  arenaHeight: number;
  time = 0;
  constructor(width: number, height: number, entities: Entity[]) {
    this.arenaWidth = width;
    this.arenaHeight = height;
    this.entities = entities;
  }

  getNearby(_position: { x: number; y: number }, _radius: number): Entity[] {
    // Return every creature — this is a small map anyway.
    return this.entities.filter((e) => e.isAlive && e instanceof Creature);
  }

  spawn(entity: Entity): void {
    this.entities.push(entity);
  }
}

// ---------------------------------------------------------------------------
// Helper: spawn N Blob creatures at (cx, cy) inside a Tiny Wide arena.
// ---------------------------------------------------------------------------
function spawnBlobs(
  count: number,
  cx: number,
  cy: number,
): { creatures: Creature[]; world: MockWorld } {
  const creatures: Creature[] = [];
  for (let i = 0; i < count; i++) {
    const c = new Creature(
      { x: cx, y: cy },
      {
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
        behaviour: { name: "Grazer", decide: () => ({ x: 0, y: 0 }) },
      },
    );
    creatures.push(c);
  }

  // Tiny Wide: scale 0.35 → 1500×1000
  const world = new MockWorld(1500, 1000, creatures);
  return { creatures, world };
}

describe("Squeeze cleanup", () => {
  it("culls excess Blobs crammed into a tiny map and stabilises", () => {
    const { creatures, world } = spawnBlobs(50, 750, 500);

    // Run the sim for 30 seconds at 60 FPS
    const dt = 1 / 60;
    const totalTicks = Math.floor(30 / dt);
    // Track population over the second half of the sim — it should stabilise
    // rather than trending toward zero.
    const lateSamples: number[] = [];

    for (let tick = 0; tick < totalTicks; tick++) {
      world.time += dt;

      // Update every creature
      for (const c of creatures) {
        if (c.isAlive) c.update(dt, world);
      }

      const alive = creatures.filter((c) => c.isAlive).length;

      // Sample every second of sim time during the second half
      if (tick > totalTicks / 2 && tick % Math.round(1 / dt) === 0) {
        lateSamples.push(alive);
      }
    }

    const finalAlive = creatures.filter((c) => c.isAlive).length;

    // At least half the Blobs should have been culled by squeeze damage
    expect(finalAlive).toBeLessThan(creatures.length * 0.5);
    // Not all of them should be dead — the culling should stabilise
    expect(finalAlive).toBeGreaterThan(0);

    // Population should be stable (non-zero variance but no death spiral):
    // the last few late samples should all be positive.
    for (const sample of lateSamples) {
      expect(sample).toBeGreaterThan(0);
    }

    // The late samples should be roughly equal (no sharp drop at the end).
    const mean = lateSamples.reduce((a, b) => a + b, 0) / lateSamples.length;
    for (const sample of lateSamples) {
      // Allow up to 30% deviation from the mean — loose bound for stochastic
      // processes, but catches a death spiral.
      expect(Math.abs(sample - mean)).toBeLessThan(mean * 0.3);
    }
  });

  it("does not kill a single Blob in a tiny map (no squeeze)", () => {
    const { creatures, world } = spawnBlobs(1, 750, 500);

    const dt = 1 / 60;
    for (let tick = 0; tick < 600; tick++) {
      world.time += dt;
      for (const c of creatures) {
        if (c.isAlive) c.update(dt, world);
      }
    }

    const alive = creatures.filter((c) => c.isAlive).length;
    expect(alive).toBe(1);
  });

  it("does not kill 3 Blobs (below SQUEEZE_NEIGHBOUR_MIN threshold)", () => {
    const { creatures, world } = spawnBlobs(3, 750, 500);

    const dt = 1 / 60;
    for (let tick = 0; tick < 600; tick++) {
      world.time += dt;
      for (const c of creatures) {
        if (c.isAlive) c.update(dt, world);
      }
    }

    const alive = creatures.filter((c) => c.isAlive).length;
    // 3 is below the SQUEEZE_NEIGHBOUR_MIN of 4, so no squeeze damage
    expect(alive).toBe(3);
  });
});
