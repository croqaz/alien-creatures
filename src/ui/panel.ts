import type { Game } from "../core/game";
import {
  getSpeciesList,
  getSpecies,
  createWithElite,
  type SpeciesDef,
} from "../entities/creatures/registry";
import { Food } from "../entities/food";
import { Heart } from "../entities/heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "../entities/powerup";
import { Creature } from "../entities/creature";
import { Spawner } from "../entities/spawner";
import type { Entity } from "../entities/entity";
import { Vec2, randomInRect, distance } from "../utils/vec2";

/** Which spawn tab is showing — drives what Place mode drops. */
type Tab = "creatures" | "objects";
/** The placeable object kinds offered in the Objects tab's selector. */
type ObjectKind = "wall" | "shield" | "speed" | "sword" | "spawner";

export class Panel {
  private activeTab: Tab = "creatures";
  /** When on, a left-click drops the active tab's current selection. */
  private placeMode = false;
  /** When on, a left-click removes whatever is under the cursor. */
  private deleteMode = false;
  /** Last non-zero sim speed, restored when un-pausing with Space. */
  private prevSpeed = 1;

  constructor(private game: Game) {
    this.populateSpeciesSelect();
    this.bindButtons();
    this.bindSpeedControls();
    this.bindKeyboard();
  }

  /**
   * Pick a random spawn position that isn't inside a wall, so creatures and
   * food never spawn somewhere unreachable. Falls back to the last try if the
   * map is too full of walls.
   */
  private randomFreePos(margin: number, clearance: number): Vec2 {
    let pos = randomInRect(
      margin,
      margin,
      this.game.arena.width - margin * 2,
      this.game.arena.height - margin * 2,
    );
    for (let i = 0; i < 12 && this.game.walls.overlaps(pos, clearance); i++) {
      pos = randomInRect(
        margin,
        margin,
        this.game.arena.width - margin * 2,
        this.game.arena.height - margin * 2,
      );
    }
    return pos;
  }

  /**
   * Build a creature of `species` at `pos`, applying the rare automatic Elite
   * promotion. Shared by the batch "Spawn Creatures" button and click-to-place
   * so both routes can produce elites identically — and neither lets the GUI
   * promote a boss or boss minion (canBeElite === false).
   */
  private makeCreature(species: SpeciesDef, pos: Vec2): Creature {
    return createWithElite(species, pos);
  }

  /**
   * Drop a power-up at `worldPos`, unless it would sit inside a wall or stack on
   * top of an existing power-up (so drag-painting leaves a tidy spread, not a
   * pile). `make` builds the entity from the chosen position.
   */
  private placePowerup(
    worldPos: Vec2,
    make: (pos: Vec2) => Entity & { radius: number },
  ) {
    const r = 16;
    if (this.game.walls.overlaps(worldPos, r)) return;
    for (const e of this.game.entities) {
      if (
        (e instanceof ShieldPowerup ||
          e instanceof SpeedPowerup ||
          e instanceof SwordPowerup) &&
        e.isAlive &&
        distance(worldPos, e.position) < e.radius * 2
      ) {
        return;
      }
    }
    this.game.addEntity(make({ ...worldPos }));
  }

  /** Stamp a wall at `worldPos` and clear anything now buried inside it. */
  private placeWall(worldPos: Vec2) {
    this.game.walls.placeAt(worldPos);
    // Remove any food/hearts/power-ups now buried in the wall so nothing
    // chases the unreachable.
    for (const e of this.game.entities) {
      if (
        (e instanceof Food ||
          e instanceof Heart ||
          e instanceof ShieldPowerup ||
          e instanceof SpeedPowerup ||
          e instanceof SwordPowerup) &&
        e.isAlive &&
        this.game.walls.overlaps(e.position, e.radius)
      ) {
        e.isAlive = false;
      }
    }
  }

  /** Place the selected creature species at the click position (if not walled). */
  private placeCreatureAt(worldPos: Vec2) {
    const species = getSpecies(this.speciesSelect.value);
    if (!species) return;
    // Don't drop a creature inside a wall — give it body-sized clearance.
    if (this.game.walls.overlaps(worldPos, 24)) return;
    // Don't pile up: skip if a living creature already sits at this spot, so a
    // click-drag paints a tidy spread rather than a stack (matches power-ups).
    for (const e of this.game.entities) {
      if (
        e instanceof Creature &&
        e.isAlive &&
        distance(worldPos, e.position) < e.radius
      ) {
        return;
      }
    }
    this.game.addEntity(this.makeCreature(species, { ...worldPos }));
  }

  /** Place the object kind currently chosen in the Objects tab at the click. */
  private placeObjectAt(worldPos: Vec2) {
    switch (this.objectSelect.value as ObjectKind) {
      case "wall":
        this.placeWall(worldPos);
        break;
      case "shield":
        this.placePowerup(worldPos, (p) => new ShieldPowerup(p));
        break;
      case "speed":
        this.placePowerup(worldPos, (p) => new SpeedPowerup(p));
        break;
      case "sword":
        this.placePowerup(worldPos, (p) => new SwordPowerup(p));
        break;
      case "spawner":
        this.placeSpawnerAt(worldPos);
        break;
    }
  }

  /** Place a Creature Spawner tower of the configured species/rate at the click. */
  private placeSpawnerAt(worldPos: Vec2) {
    const species = getSpecies(this.spawnerSelect.value);
    if (!species) return;
    // Give the tower footprint clearance from walls, and don't stack towers.
    if (this.game.walls.overlaps(worldPos, 28)) return;
    for (const e of this.game.entities) {
      if (
        e instanceof Spawner &&
        e.isAlive &&
        distance(worldPos, e.position) < e.radius * 2
      ) {
        return;
      }
    }
    const rate = Number(this.spawnerSpeed.value);
    this.game.addEntity(new Spawner({ ...worldPos }, species, rate));
  }

  /** Remove whatever the user clicked: a wall, else the nearest entity. */
  private deleteAt(worldPos: Vec2) {
    // A wall under the cursor takes priority.
    if (this.game.walls.removeAt(worldPos)) return;
    // Otherwise kill the closest entity the cursor is actually over — covers
    // creatures and objects alike (the Delete tool serves both tabs).
    let closest: (Entity & { radius: number }) | null = null;
    let closestDist = Infinity;
    for (const e of this.game.entities) {
      if (!e.isAlive) continue;
      const deletable =
        e instanceof Creature ||
        e instanceof Food ||
        e instanceof Heart ||
        e instanceof ShieldPowerup ||
        e instanceof SpeedPowerup ||
        e instanceof SwordPowerup;
      if (!deletable) continue;
      const ent = e as Entity & { radius: number };
      const d = distance(worldPos, ent.position);
      if (d < ent.radius + 5 && d < closestDist) {
        closest = ent;
        closestDist = d;
      }
    }
    if (closest) {
      closest.isAlive = false;
      if (closest instanceof Creature) closest.deathTime = performance.now();
    }
  }

  private populateSpeciesSelect() {
    for (const species of getSpeciesList()) {
      const opt = document.createElement("option");
      opt.value = species.name;
      opt.textContent = `${species.name} — ${species.description}`;
      this.speciesSelect.appendChild(opt);
    }
    // The spawner picker offers every regular creature — bosses opt out.
    for (const species of getSpeciesList()) {
      if (species.canSpawn === false) continue;
      const opt = document.createElement("option");
      opt.value = species.name;
      opt.textContent = species.name;
      this.spawnerSelect.appendChild(opt);
    }
  }

  // Element handles used across the placement/delete handlers.
  private get speciesSelect() {
    return document.getElementById("species-select") as HTMLSelectElement;
  }
  private get objectSelect() {
    return document.getElementById("object-select") as HTMLSelectElement;
  }
  private get spawnerSelect() {
    return document.getElementById("spawner-select") as HTMLSelectElement;
  }
  private get spawnerSpeed() {
    return document.getElementById("spawner-speed") as HTMLInputElement;
  }

  private bindButtons() {
    const tabCreatures = document.getElementById("tab-creatures")!;
    const tabObjects = document.getElementById("tab-objects")!;
    const panelCreatures = document.getElementById("panel-creatures")!;
    const panelObjects = document.getElementById("panel-objects")!;

    const spawnCreatureBtn = document.getElementById("spawn-creature-btn")!;
    const spawnFoodBtn = document.getElementById("spawn-food-btn")!;
    const spawnHeartBtn = document.getElementById("spawn-heart-btn")!;
    const creatureCount = document.getElementById(
      "creature-count",
    ) as HTMLInputElement;
    const creatureCountVal = document.getElementById("creature-count-val")!;
    const foodCount = document.getElementById("food-count") as HTMLInputElement;
    const foodCountVal = document.getElementById("food-count-val")!;
    const heartCount = document.getElementById(
      "heart-count",
    ) as HTMLInputElement;
    const heartCountVal = document.getElementById("heart-count-val")!;
    const placeModeBtn = document.getElementById("place-mode-btn")!;
    const deleteModeBtn = document.getElementById("delete-mode-btn")!;
    const spawnerConfig = document.getElementById("spawner-config")!;
    const spawnerSpeedVal = document.getElementById("spawner-speed-val")!;
    const canvas = document.getElementById("game") as HTMLCanvasElement;

    const refreshModeButtons = () => {
      const placeNoun = this.activeTab === "creatures" ? "Creature" : "Object";
      placeModeBtn.textContent = `Place ${placeNoun}: ${this.placeMode ? "ON" : "OFF"}`;
      placeModeBtn.classList.toggle("active", this.placeMode);
      deleteModeBtn.textContent = `Delete Mode: ${this.deleteMode ? "ON" : "OFF"}`;
      deleteModeBtn.classList.toggle("active", this.deleteMode);

      // Cursor feedback: a crosshair for delete, a "cell" cursor while painting
      // walls, and the copy cursor for every other placement.
      const placingWall =
        this.placeMode &&
        this.activeTab === "objects" &&
        this.objectSelect.value === "wall";
      canvas.classList.toggle("deleting", this.deleteMode);
      canvas.classList.toggle("building", placingWall);
      canvas.classList.toggle("placing", this.placeMode && !placingWall);
    };

    // Place and Delete are mutually exclusive map-click modes.
    const setMode = (mode: "place" | "delete" | "none") => {
      this.placeMode = mode === "place";
      this.deleteMode = mode === "delete";
      refreshModeButtons();
    };

    const switchTab = (tab: Tab) => {
      this.activeTab = tab;
      tabCreatures.classList.toggle("active", tab === "creatures");
      tabObjects.classList.toggle("active", tab === "objects");
      panelCreatures.toggleAttribute("hidden", tab !== "creatures");
      panelObjects.toggleAttribute("hidden", tab !== "objects");
      // Place mode follows the active tab; refresh its label and cursor.
      refreshModeButtons();
    };

    tabCreatures.addEventListener("click", () => switchTab("creatures"));
    tabObjects.addEventListener("click", () => switchTab("objects"));

    // Sliders mirror their current value into the adjacent label as you drag.
    creatureCount.addEventListener("input", () => {
      creatureCountVal.textContent = creatureCount.value;
    });
    foodCount.addEventListener("input", () => {
      foodCountVal.textContent = foodCount.value;
    });
    heartCount.addEventListener("input", () => {
      heartCountVal.textContent = heartCount.value;
    });

    spawnCreatureBtn.addEventListener("click", () => {
      const species = getSpecies(this.speciesSelect.value);
      if (!species) return;
      const n = Number(creatureCount.value);
      for (let i = 0; i < n; i++) {
        this.game.addEntity(
          this.makeCreature(species, this.randomFreePos(100, 24)),
        );
      }
    });

    spawnFoodBtn.addEventListener("click", () => {
      const n = Number(foodCount.value);
      for (let i = 0; i < n; i++) {
        this.game.addEntity(new Food(this.randomFreePos(50, 8)));
      }
    });

    spawnHeartBtn.addEventListener("click", () => {
      const n = Number(heartCount.value);
      for (let i = 0; i < n; i++) {
        this.game.addEntity(new Heart(this.randomFreePos(50, 10)));
      }
    });

    placeModeBtn.addEventListener("click", () =>
      setMode(this.placeMode ? "none" : "place"),
    );
    deleteModeBtn.addEventListener("click", () =>
      setMode(this.deleteMode ? "none" : "delete"),
    );

    // The spawner config (creature + rate) is only relevant when the chosen
    // object is a Creature Spawner; reveal it then, and refresh the cursor.
    const refreshSpawnerConfig = () => {
      spawnerConfig.toggleAttribute(
        "hidden",
        this.objectSelect.value !== "spawner",
      );
    };
    this.objectSelect.addEventListener("change", () => {
      refreshSpawnerConfig();
      refreshModeButtons();
    });
    this.spawnerSpeed.addEventListener("input", () => {
      spawnerSpeedVal.textContent = this.spawnerSpeed.value;
    });
    refreshSpawnerConfig();

    // Single left-click/drag handler dispatches to the active map tool.
    this.game.input.onClick = (worldPos: Vec2) => {
      if (this.deleteMode) {
        this.deleteAt(worldPos);
      } else if (this.placeMode) {
        if (this.activeTab === "creatures") this.placeCreatureAt(worldPos);
        else this.placeObjectAt(worldPos);
      }
    };

    refreshModeButtons();
  }

  private bindSpeedControls() {
    const buttons = document.querySelectorAll(".speed-controls button");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const speed = Number((btn as HTMLElement).dataset["speed"]);
        this.setSpeed(speed);
      });
    });
  }

  /** Set the sim speed and keep the speed buttons' highlight in sync. */
  private setSpeed(speed: number) {
    this.game.simSpeed = speed;
    if (speed !== 0) this.prevSpeed = speed; // remember it for un-pausing
    const buttons = document.querySelectorAll(".speed-controls button");
    buttons.forEach((b) => {
      const s = Number((b as HTMLElement).dataset["speed"]);
      b.classList.toggle("active", s === speed);
    });
  }

  /** Space toggles pause, restoring the previous speed when resumed. */
  private bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (e.code !== "Space" && e.key !== " ") return;
      // Don't hijack Space while a form control (slider, select) has focus.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      e.preventDefault();
      this.setSpeed(this.game.simSpeed === 0 ? this.prevSpeed : 0);
    });
  }

  updateStats() {
    const statsEl = document.getElementById("stats")!;
    // Spawners are Creatures under the hood; keep them out of the creature
    // tally and species breakdown, and count them on their own line.
    const creatures = this.game.entities.filter(
      (e: Entity) =>
        e instanceof Creature && !(e instanceof Spawner) && e.isAlive,
    );
    const spawners = this.game.entities.filter(
      (e: Entity) => e instanceof Spawner && e.isAlive,
    );
    const food = this.game.entities.filter(
      (e: Entity) => e instanceof Food && e.isAlive,
    );
    const hearts = this.game.entities.filter(
      (e: Entity) => e instanceof Heart && e.isAlive,
    );
    const shields = this.game.entities.filter(
      (e: Entity) => e instanceof ShieldPowerup && e.isAlive,
    );
    const speeds = this.game.entities.filter(
      (e: Entity) => e instanceof SpeedPowerup && e.isAlive,
    );
    const swords = this.game.entities.filter(
      (e: Entity) => e instanceof SwordPowerup && e.isAlive,
    );

    const byCounts = new Map<string, number>();
    for (const c of creatures) {
      if (c instanceof Creature) {
        byCounts.set(c.species, (byCounts.get(c.species) ?? 0) + 1);
      }
    }

    let html = `Creatures: ${creatures.length} &nbsp;|&nbsp; Spawners: ${spawners.length} &nbsp;|&nbsp; Food: ${food.length} &nbsp;|&nbsp; Hearts: ${hearts.length} &nbsp;|&nbsp; Shields: ${shields.length} &nbsp;|&nbsp; Speed: ${speeds.length} &nbsp;|&nbsp; Swords: ${swords.length}<br>`;
    for (const [name, count] of byCounts) {
      html += `${name}: ${count} &nbsp; `;
    }
    statsEl.innerHTML = html;
  }
}
