import { createWorld } from "./core/world";
import { Renderer } from "./rendering/index";
import { UIPanel } from "./ui/panel";
import { EditorMode } from "./ui/mode";
import { Tooltip } from "./ui/tooltip";
import { Creature, CreatureSpecies } from "./entities/creature";
import { Food } from "./entities/food";
import { SpawnerTower } from "./entities/spawner";
import { BuffEntity, BuffType } from "./entities/buffs";
import { getBehavioursForSpecies } from "./behaviours/index";
import { ARENA_WIDTH, ARENA_HEIGHT, GAME_SPEEDS } from "./core/config";
import { vec, vecDist, rand } from "./utils/math";
import { EntityKind } from "./entities/entity";
import type { Entity } from "./entities/entity";

// ── Initialize ──

const world = createWorld();
const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const panel = new UIPanel();
const tooltip = new Tooltip();

panel.setWorld(world);
panel.setRenderer(renderer);
tooltip.setWorld(world);
tooltip.setRenderer(renderer);

// ── Mode wiring ──

panel.onModeChange = (mode: EditorMode) => {
  renderer.setEditorMode(mode);
  // Clear placement preview when switching away from Place
  if (mode !== EditorMode.Place) {
    renderer.placementPreview = null;
    panel.pendingPlacement = null;
  }
};

// ── Game state ──

let gameSpeedIndex = 1;
let paused = false;
let lastTime = performance.now();

// ── Move-drag state ──

let dragEntity: Entity | null = null;
let dragOffset: { x: number; y: number } = { x: 0, y: 0 };

// ── Initial spawns for demo ──

function spawnInitial(): void {
  const center = vec(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);

  const speciesList: CreatureSpecies[] = [
    "blob",
    "floater",
    "crawler",
    "defender",
    "lurker",
    "spiker",
  ];
  for (const sp of speciesList) {
    for (let i = 0; i < 3; i++) {
      const creature = new Creature(sp, {
        x: center.x + rand(-600, 600),
        y: center.y + rand(-600, 600),
      });
      creature.behaviours = getBehavioursForSpecies(sp);
      world.spawn(creature);
    }
  }

  for (let i = 0; i < 20; i++) {
    world.spawn(
      new Food(
        {
          x: rand(200, ARENA_WIDTH - 200),
          y: rand(200, ARENA_HEIGHT - 200),
        },
        "fuel",
      ),
    );
  }
  for (let i = 0; i < 15; i++) {
    world.spawn(
      new Food(
        {
          x: rand(200, ARENA_WIDTH - 200),
          y: rand(200, ARENA_HEIGHT - 200),
        },
        "health",
      ),
    );
  }

  world.spawn(
    new BuffEntity(
      {
        x: center.x + rand(-300, 300),
        y: center.y + rand(-300, 300),
      },
      BuffType.Shield,
    ),
  );
  world.spawn(
    new BuffEntity(
      {
        x: center.x + rand(-300, 300),
        y: center.y + rand(-300, 300),
      },
      BuffType.Speed,
    ),
  );
  world.spawn(
    new BuffEntity(
      {
        x: center.x + rand(-300, 300),
        y: center.y + rand(-300, 300),
      },
      BuffType.Dagger,
    ),
  );

  world.spawn(
    new SpawnerTower(
      {
        x: center.x - 400,
        y: center.y - 400,
      },
      "blob",
    ),
  );
  world.spawn(
    new SpawnerTower(
      {
        x: center.x + 400,
        y: center.y + 400,
      },
      "spiker",
    ),
  );
}

spawnInitial();

// ── Input: game speed ──

window.addEventListener("keydown", (e) => {
  // Don't capture when typing in inputs
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return;

  if (e.key === " ") {
    e.preventDefault();
    paused = !paused;
  }
  const num = parseInt(e.key);
  if (num >= 1 && num <= 4) {
    gameSpeedIndex = num;
    paused = false;
  }
});

// ── Find entity at world position ──

function findEntityAt(worldPos: { x: number; y: number }): Entity | null {
  let best: Entity | null = null;
  let bestDist = Infinity;
  for (const entity of world.entities) {
    const dist = vecDist(worldPos, entity.position);
    const range = entity.radius + 8;
    if (dist <= range && dist < bestDist) {
      bestDist = dist;
      best = entity;
    }
  }
  return best;
}

// ── Canvas click / drag handling ──

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return; // left-click only
  const worldPos = renderer.screenToWorld(e.clientX, e.clientY);

  switch (renderer.editorMode) {
    case EditorMode.Select: {
      // Select nearest creature
      let bestDist = Infinity;
      let bestCreature: Creature | null = null;
      for (const entity of world.entities) {
        if (entity.kind !== EntityKind.Creature) continue;
        const c = entity as Creature;
        if (c.health <= 0) continue;
        const dist = vecDist(worldPos, c.position);
        if (dist < c.radius + 10 && dist < bestDist) {
          bestDist = dist;
          bestCreature = c;
        }
      }
      panel.setSelectedCreature(bestCreature);
      break;
    }

    case EditorMode.Place: {
      if (panel.pendingPlacement) {
        panel.spawnAtViewport(worldPos);
        renderer.placementPreview = null;
      }
      break;
    }

    case EditorMode.Move: {
      const entity = findEntityAt(worldPos);
      if (entity) {
        dragEntity = entity;
        dragOffset = {
          x: entity.position.x - worldPos.x,
          y: entity.position.y - worldPos.y,
        };
        renderer.canvas.style.cursor = "grabbing";
        // Select if creature
        if (entity.kind === EntityKind.Creature) {
          panel.setSelectedCreature(entity as Creature);
        }
      }
      break;
    }

    case EditorMode.Delete: {
      const entity = findEntityAt(worldPos);
      if (entity) {
        world.remove(entity);
        if (renderer.selectedEntityId === entity.id) {
          panel.setSelectedCreature(null);
        }
      }
      break;
    }
  }
});

window.addEventListener("mousemove", (e) => {
  if (dragEntity && renderer.editorMode === EditorMode.Move) {
    const worldPos = renderer.screenToWorld(e.clientX, e.clientY);
    dragEntity.position.x = Math.max(
      dragEntity.radius,
      Math.min(world.arenaWidth - dragEntity.radius, worldPos.x + dragOffset.x),
    );
    dragEntity.position.y = Math.max(
      dragEntity.radius,
      Math.min(
        world.arenaHeight - dragEntity.radius,
        worldPos.y + dragOffset.y,
      ),
    );
  }

  // Update hover for delete mode / tooltip
  const worldPos = renderer.screenToWorld(e.clientX, e.clientY);
  if (renderer.editorMode === EditorMode.Delete) {
    const hovered = findEntityAt(worldPos);
    renderer.hoveredEntityId = hovered?.id ?? null;
  } else {
    renderer.hoveredEntityId = null;
  }

  // Sync placement preview
  if (renderer.editorMode === EditorMode.Place && panel.pendingPlacement) {
    renderer.placementPreview = panel.pendingPlacement;
  } else if (renderer.editorMode !== EditorMode.Place) {
    renderer.placementPreview = null;
  }
});

window.addEventListener("mouseup", () => {
  if (dragEntity) {
    dragEntity = null;
    renderer.canvas.style.cursor = "grab";
  }
});

// ── Game loop ──

function gameLoop(timestamp: number): void {
  const rawDt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  const dt = Math.min(rawDt, 0.05);

  if (!paused) {
    const speed = GAME_SPEEDS[gameSpeedIndex] ?? 1;
    const scaledDt = dt * speed;

    const entities = [...world.entities];
    for (const entity of entities) {
      entity.update(scaledDt, world);
    }

    // Remove dead
    for (let i = world.entities.length - 1; i >= 0; i--) {
      const e = world.entities[i]!;
      if (e.kind === EntityKind.Creature) {
        const c = e as Creature;
        if (c.health <= 0) {
          const nearby = world.getEntitiesInRadius(c.position, 100);
          for (const n of nearby) {
            if (n instanceof Creature && n.isAggressive && n.health > 0) {
              n.heal(20);
            }
          }
          world.remove(e);
        }
      } else if (e.kind === EntityKind.Spawner) {
        const s = e as SpawnerTower;
        if (s.health <= 0) {
          world.remove(e);
        }
      }
    }

    // Deselect if selection died
    const selId = renderer.selectedEntityId;
    if (selId != null && !world.entities.some((e) => e.id === selId)) {
      panel.setSelectedCreature(null);
    }

    world.time += scaledDt;
  }

  // Clear drag if entity was removed
  if (dragEntity && !world.entities.includes(dragEntity)) {
    dragEntity = null;
    renderer.canvas.style.cursor = "grab";
  }

  panel.updateStats();

  renderer.gameSpeed = paused ? 0 : (GAME_SPEEDS[gameSpeedIndex] ?? 1);
  renderer.render(world);

  requestAnimationFrame(gameLoop);
}

// ── Handle resize ──

window.addEventListener("resize", () => {
  renderer.resize();
});

// ── Start ──

requestAnimationFrame(gameLoop);
