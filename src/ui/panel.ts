import type { Game } from "../core/game";
import {
  createWithVariant,
  getSpecies,
  getSpeciesList,
  type SpeciesDef,
} from "../entities/creatures/registry";
import { Food } from "../entities/food";
import { Heart } from "../entities/heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "../entities/powerup";
import { Creature } from "../entities/creature";
import { Spawner } from "../entities/spawner";
import { CreativeSpawner } from "../entities/creative-spawner";
import type { Entity } from "../entities/entity";
import { deserializeMap, serializeMap } from "../core/map-io";
import { distance, randomInRect, Vec2 } from "../utils/vec2";
import { type BlockType, WALL_SIZE } from "../entities/wall";

/** Which spawn tab is showing — drives what Place mode drops. */
type Tab = "creatures" | "objects";
/** The placeable object kinds offered in the Objects tab's selector. */
type ObjectKind =
  "stone" | "dirt" | "shield" | "speed" | "sword" | "spawner" | "creative";
/**
 * The active map-click tool. Exactly one is active at a time:
 *  - select: highlight/inspect the creature under the cursor
 *  - place:  drop the active tab's current selection where you click
 *  - move:   grab a creature and drag-and-drop it
 *  - delete: remove whatever you click
 */
type Mode = "select" | "place" | "move" | "delete";

export class Panel {
  private activeTab: Tab = "creatures";
  /** The active map-click tool; defaults to the harmless Select. */
  private mode: Mode = "select";
  /** The creature currently being dragged by the Move tool, if any. */
  private grabbed: Creature | null = null;
  /** Last non-zero sim speed, restored when un-pausing with Space. */
  private prevSpeed = 1;

  /** The Creative Spawner whose menu is currently shown (matches selection). */
  private csShown: CreativeSpawner | null = null;
  /** Index of the program step highlighted for Remove, or -1 for none. */
  private csSelectedStep = -1;

  constructor(private game: Game) {
    this.populateSpeciesSelect();
    this.bindButtons();
    this.bindSpeedControls();
    this.bindKeyboard();
    this.bindCreativeMenu();
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
   * Build a creature of `species` at `pos`, applying the rare automatic Elite /
   * Archer promotions. Shared by the batch "Spawn Creatures" button and
   * click-to-place so both routes produce variants identically — and neither
   * lets the GUI promote a species that opts out (e.g. bosses).
   */
  private makeCreature(species: SpeciesDef, pos: Vec2): Creature {
    return createWithVariant(species, pos);
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
    // A square brush drops one power-up per cell (subject to the checks below).
    for (const o of this.brushCells("square")) {
      this.placeOnePowerup({ x: worldPos.x + o.x, y: worldPos.y + o.y }, make);
    }
  }

  /** Drop a single power-up at `pos` unless it's walled or stacked on another. */
  private placeOnePowerup(
    pos: Vec2,
    make: (pos: Vec2) => Entity & { radius: number },
  ) {
    const r = 16;
    if (this.game.walls.overlaps(pos, r)) return;
    for (const e of this.game.entities) {
      if (
        (e instanceof ShieldPowerup ||
          e instanceof SpeedPowerup ||
          e instanceof SwordPowerup) &&
        e.isAlive &&
        distance(pos, e.position) < e.radius * 2
      ) {
        return;
      }
    }
    this.game.addEntity(make({ ...pos }));
  }

  /**
   * Stamp a block of `type` at `worldPos` and clear anything now buried inside
   * it. The brush paints an N×N square of cells centred on the cursor (N is the
   * odd brush size 1–9), so a single click/drag can lay down thick walls.
   */
  private placeBlock(worldPos: Vec2, type: BlockType) {
    for (const o of this.brushCells("square")) {
      this.game.walls.placeAt(
        { x: worldPos.x + o.x, y: worldPos.y + o.y },
        type,
      );
    }
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

  /**
   * Place the selected creature species at the click. The brush spreads
   * creatures in an N×N *diamond* (Manhattan reach), so 1/3/5/7/9 drop 1/5/13/
   * 25/41 creatures in a "+" and ever-rounder cluster.
   */
  private placeCreatureAt(worldPos: Vec2) {
    const species = getSpecies(this.speciesSelect.value);
    if (!species) return;
    for (const o of this.brushCells("diamond")) {
      this.placeOneCreature(species, {
        x: worldPos.x + o.x,
        y: worldPos.y + o.y,
      });
    }
  }

  /** Drop a single creature of `species` at `pos`, unless walled or stacked. */
  private placeOneCreature(species: SpeciesDef, pos: Vec2) {
    // Don't drop a creature inside a wall — give it body-sized clearance.
    if (this.game.walls.overlaps(pos, 24)) return;
    // Don't pile up: skip if a living creature already sits at this spot, so a
    // click-drag paints a tidy spread rather than a stack (matches power-ups).
    for (const e of this.game.entities) {
      if (
        e instanceof Creature &&
        e.isAlive &&
        distance(pos, e.position) < e.radius
      ) {
        return;
      }
    }
    this.game.addEntity(this.makeCreature(species, { ...pos }));
  }

  /** Place the object kind currently chosen in the Objects tab at the click. */
  private placeObjectAt(worldPos: Vec2) {
    switch (this.objectSelect.value as ObjectKind) {
      case "stone":
        this.placeBlock(worldPos, "stone");
        break;
      case "dirt":
        this.placeBlock(worldPos, "dirt");
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
      case "creative":
        this.placeCreativeSpawnerAt(worldPos);
        break;
    }
  }

  /**
   * Place an indestructible Creative Spawner at the click, then select it so its
   * control menu pops up immediately. Same footprint/anti-stacking rules as the
   * Creature Spawner (it sits in the same family of towers).
   */
  private placeCreativeSpawnerAt(worldPos: Vec2) {
    if (this.game.walls.overlaps(worldPos, 28)) return;
    for (const e of this.game.entities) {
      if (
        (e instanceof Spawner || e instanceof CreativeSpawner) &&
        e.isAlive &&
        distance(worldPos, e.position) < e.radius * 2
      ) {
        return;
      }
    }
    const spawner = new CreativeSpawner({ ...worldPos });
    this.game.addEntity(spawner);
    // Surface its menu right away (selection drives the floating panel).
    this.game.selected = spawner;
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

  private isDeletable(e: Entity): e is Entity & { radius: number } {
    return (
      e instanceof Creature ||
      e instanceof Food ||
      e instanceof Heart ||
      e instanceof ShieldPowerup ||
      e instanceof SpeedPowerup ||
      e instanceof SwordPowerup
    );
  }

  private kill(e: Entity) {
    e.isAlive = false;
    if (e instanceof Creature) e.deathTime = performance.now();
  }

  /**
   * Delete tool. At brush size 1 it precisely removes a single thing under the
   * cursor — a wall, else the closest entity. At larger sizes it acts as an
   * eraser, clearing every wall and entity within the N×N square.
   */
  private deleteAt(worldPos: Vec2) {
    const reach = Math.floor(this.brushSize / 2);

    if (reach === 0) {
      // A wall under the cursor takes priority.
      if (this.game.walls.removeAt(worldPos)) return;
      // Otherwise kill the closest entity the cursor is actually over.
      let closest: (Entity & { radius: number }) | null = null;
      let closestDist = Infinity;
      for (const e of this.game.entities) {
        if (!e.isAlive || !this.isDeletable(e)) continue;
        const d = distance(worldPos, e.position);
        if (d < e.radius + 5 && d < closestDist) {
          closest = e;
          closestDist = d;
        }
      }
      if (closest) this.kill(closest);
      return;
    }

    // Area eraser: wipe every wall cell in the square and every entity whose
    // body falls inside it.
    for (const o of this.brushCells("square")) {
      this.game.walls.removeAt({ x: worldPos.x + o.x, y: worldPos.y + o.y });
    }
    const ext = reach * WALL_SIZE + WALL_SIZE / 2;
    for (const e of this.game.entities) {
      if (!e.isAlive || !this.isDeletable(e)) continue;
      if (
        Math.abs(e.position.x - worldPos.x) <= ext + e.radius &&
        Math.abs(e.position.y - worldPos.y) <= ext + e.radius
      ) {
        this.kill(e);
      }
    }
  }

  /** The living creature the cursor is over (closest within its body), or null. */
  private creatureAt(worldPos: Vec2): Creature | null {
    let closest: Creature | null = null;
    let closestDist = Infinity;
    for (const e of this.game.entities) {
      if (!(e instanceof Creature) || !e.isAlive) continue;
      const d = distance(worldPos, e.position);
      if (d < e.radius + 5 && d < closestDist) {
        closest = e;
        closestDist = d;
      }
    }
    return closest;
  }

  /** Select tool: highlight the creature under the cursor (or clear on empty space). */
  private selectAt(worldPos: Vec2) {
    this.game.selected = this.creatureAt(worldPos);
  }

  /**
   * Move tool: on the first click of a drag, grab the creature under the cursor;
   * every subsequent drag event teleports the grabbed creature to follow the
   * mouse, with its momentum zeroed so it stays put rather than flinging off.
   */
  private moveAt(worldPos: Vec2) {
    if (!this.grabbed) {
      this.grabbed = this.creatureAt(worldPos);
      // Surface the grabbed creature in the selection ring too.
      if (this.grabbed) this.game.selected = this.grabbed;
      return;
    }
    this.grabbed.position = { ...worldPos };
    this.grabbed.velocity = { x: 0, y: 0 };
    // Drop any in-progress steering so the behaviour re-plans from the new spot.
    this.grabbed.steerTarget = null;
    // An immovable spawner re-pins to its anchor each frame, so move the anchor
    // too or the drag snaps right back.
    if (this.grabbed instanceof CreativeSpawner) {
      this.grabbed.relocate(worldPos);
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
  private get brushSizeInput() {
    return document.getElementById("brush-size") as HTMLInputElement;
  }
  /** Side length (in cells) of the brush — an odd number, 1–9. */
  private get brushSize(): number {
    return Number(this.brushSizeInput.value) || 1;
  }

  /**
   * World-space offsets (one per painted cell) for the current brush, on the
   * WALL_SIZE grid and centred on (0,0). A `"square"` brush fills the whole N×N
   * block (walls, power-ups, eraser); a `"diamond"` brush keeps only cells
   * within Manhattan reach of the centre (creatures), giving the "+"-and-bigger
   * spread — 1, 5, 13, 25, 41 cells for sizes 1, 3, 5, 7, 9.
   */
  private brushCells(shape: "square" | "diamond"): Vec2[] {
    const reach = Math.floor(this.brushSize / 2);
    const cells: Vec2[] = [];
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dy = -reach; dy <= reach; dy++) {
        if (shape === "diamond" && Math.abs(dx) + Math.abs(dy) > reach) {
          continue;
        }
        cells.push({ x: dx * WALL_SIZE, y: dy * WALL_SIZE });
      }
    }
    return cells;
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
    const selectModeBtn = document.getElementById("select-mode-btn")!;
    const placeModeBtn = document.getElementById("place-mode-btn")!;
    const moveModeBtn = document.getElementById("move-mode-btn")!;
    const deleteModeBtn = document.getElementById("delete-mode-btn")!;
    const exportMapBtn = document.getElementById("export-map-btn")!;
    const importMapBtn = document.getElementById("import-map-btn")!;
    const spawnerConfig = document.getElementById("spawner-config")!;
    const spawnerSpeedVal = document.getElementById("spawner-speed-val")!;
    const canvas = document.getElementById("game") as HTMLCanvasElement;

    const refreshModeButtons = () => {
      // The Place button names what it'll drop, following the active tab.
      const placeNoun = this.activeTab === "creatures" ? "Creature" : "Object";
      placeModeBtn.textContent = `Place ${placeNoun}`;

      // Light up exactly the active tool; the rest are exclusive with it.
      selectModeBtn.classList.toggle("active", this.mode === "select");
      placeModeBtn.classList.toggle("active", this.mode === "place");
      moveModeBtn.classList.toggle("active", this.mode === "move");
      deleteModeBtn.classList.toggle("active", this.mode === "delete");

      // Cursor feedback per tool: crosshair to delete, the "cell" cursor while
      // painting walls, copy for other placements, a move cursor for drag, and
      // a pointer for select.
      const placingBlock =
        this.mode === "place" &&
        this.activeTab === "objects" &&
        (this.objectSelect.value === "stone" ||
          this.objectSelect.value === "dirt");
      canvas.classList.toggle("deleting", this.mode === "delete");
      canvas.classList.toggle("building", placingBlock);
      canvas.classList.toggle(
        "placing",
        this.mode === "place" && !placingBlock,
      );
      canvas.classList.toggle("moving", this.mode === "move");
      canvas.classList.toggle("selecting", this.mode === "select");
    };

    // The four map-click tools are mutually exclusive — picking one drops any
    // in-progress drag from the Move tool.
    const setMode = (mode: Mode) => {
      this.mode = mode;
      this.grabbed = null;
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

    // Each tool button selects its mode; clicking the active non-default tool
    // again falls back to Select (the harmless default).
    selectModeBtn.addEventListener("click", () => setMode("select"));
    placeModeBtn.addEventListener("click", () =>
      setMode(this.mode === "place" ? "select" : "place"),
    );
    moveModeBtn.addEventListener("click", () =>
      setMode(this.mode === "move" ? "select" : "move"),
    );
    deleteModeBtn.addEventListener("click", () =>
      setMode(this.mode === "delete" ? "select" : "delete"),
    );

    exportMapBtn.addEventListener("click", () => this.exportMap());
    importMapBtn.addEventListener("click", () => this.importMap());

    // The spawner config (creature + rate) is only relevant when the chosen
    // object is a Creature Spawner; reveal it then, and refresh the cursor.
    const refreshSpawnerConfig = () => {
      spawnerConfig.toggleAttribute(
        "hidden",
        this.objectSelect.value !== "spawner",
      );
    };
    // Brush size applies to Place and Delete across both tabs; just mirror its
    // value into the label.
    const brushSizeVal = document.getElementById("brush-size-val")!;
    this.brushSizeInput.addEventListener("input", () => {
      const n = this.brushSize;
      brushSizeVal.textContent = `${n}×${n}`;
    });
    this.objectSelect.addEventListener("change", () => {
      refreshSpawnerConfig();
      refreshModeButtons();
    });
    const formatSpawnerSpeed = (rate: number) => {
      // Round off range-step float fuzz (e.g. 0.30000004) to one decimal.
      const r = Math.round(rate * 10) / 10;
      // Slow rates read more naturally as a period ("1 every 10s") than "0.1 /s".
      return r < 1 ? `1 every ${Math.round(1 / r)}s` : `${r} /s`;
    };
    this.spawnerSpeed.addEventListener("input", () => {
      spawnerSpeedVal.textContent = formatSpawnerSpeed(
        Number(this.spawnerSpeed.value),
      );
    });
    refreshSpawnerConfig();

    // Single left-click/drag handler dispatches to the active map tool.
    this.game.input.onClick = (worldPos: Vec2) => {
      switch (this.mode) {
        case "select":
          this.selectAt(worldPos);
          break;
        case "place":
          if (this.activeTab === "creatures") this.placeCreatureAt(worldPos);
          else this.placeObjectAt(worldPos);
          break;
        case "move":
          this.moveAt(worldPos);
          break;
        case "delete":
          this.deleteAt(worldPos);
          break;
      }
      // Any click can change (or clear) the selection — keep the Creative
      // Spawner menu in sync immediately, not just on the 0.5s stats tick.
      this.refreshCreativeMenu();
    };

    // Releasing the mouse ends a Move drag, dropping the carried creature.
    this.game.input.onRelease = () => {
      this.grabbed = null;
    };

    refreshModeButtons();
  }

  /** Serialise the whole map and offer it to the user as a JSON download. */
  private exportMap() {
    const json = serializeMap(this.game);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alien-map-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Load a map from a JSON file the user picks. If the current map has anything
   * in it, confirm the wholesale replacement first. On success the sim pauses
   * automatically so the loaded scene can be inspected before it runs.
   */
  private importMap() {
    const populated =
      this.game.entities.length > 0 || !this.game.walls.isEmpty();
    if (
      populated &&
      !confirm(
        "Replace the whole map with the imported file? This clears all current creatures, spawners, objects and walls.",
      )
    ) {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        deserializeMap(this.game, await file.text());
        this.setSpeed(0); // pause automatically after a successful import
        this.updateStats();
      } catch (err) {
        alert(`Could not import map: ${(err as Error).message}`);
      }
    });
    input.click();
  }

  private bindSpeedControls() {
    const slider = document.getElementById("sim-speed") as HTMLInputElement;
    const pauseBtn = document.getElementById("pause-btn")!;
    slider.addEventListener("input", () => this.setSpeed(Number(slider.value)));
    pauseBtn.addEventListener("click", () => {
      // Pause toggles to 0 and back to the last running speed, same as Space.
      this.setSpeed(this.game.simSpeed === 0 ? this.prevSpeed : 0);
    });
  }

  /** Set the sim speed (0 = paused) and keep the slider, label and pause
   * button's highlight in sync. The slider tracks the last running speed, so
   * pausing leaves it parked where it was. */
  private setSpeed(speed: number) {
    this.game.simSpeed = speed;
    if (speed !== 0) this.prevSpeed = speed; // remember it for un-pausing
    const slider = document.getElementById("sim-speed") as HTMLInputElement;
    const pauseBtn = document.getElementById("pause-btn")!;
    const label = document.getElementById("sim-speed-val")!;
    if (speed !== 0) slider.value = String(speed);
    pauseBtn.classList.toggle("active", speed === 0);
    label.textContent = speed === 0 ? "Paused" : `${speed}×`;
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
        e instanceof Creature &&
        !(e instanceof Spawner) &&
        !(e instanceof CreativeSpawner) &&
        e.isAlive,
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

    // Elapsed sim time since the map started — counts normal seconds, so it
    // advances at `simSpeed` per real second (8/s at max speed, frozen at pause).
    const elapsed = Math.floor(this.game.time);
    let html = `Time: ${elapsed}s &nbsp;|&nbsp; Creatures: ${creatures.length} &nbsp;|&nbsp; Spawners: ${spawners.length} &nbsp;|&nbsp; Food: ${food.length} &nbsp;|&nbsp; Hearts: ${hearts.length} &nbsp;|&nbsp; Shields: ${shields.length} &nbsp;|&nbsp; Speed: ${speeds.length} &nbsp;|&nbsp; Swords: ${swords.length}<br>`;
    for (const [name, count] of byCounts) {
      html += `${name}: ${count} &nbsp; `;
    }
    statsEl.innerHTML = html;

    // Piggyback the live Creative Spawner progress on the same cadence.
    this.refreshCreativeMenu();
  }

  // ---- Creative Spawner control menu -------------------------------------

  private get csMenu() {
    return document.getElementById("creative-menu")!;
  }
  private get csProgramEl() {
    return document.getElementById("cs-program")!;
  }
  private get csStatusEl() {
    return document.getElementById("cs-status")!;
  }

  /** The species a round may emit — same set the Creature Spawner offers. */
  private spawnableSpeciesNames(): string[] {
    return getSpeciesList()
      .filter((s) => s.canSpawn !== false)
      .map((s) => s.name);
  }

  private bindCreativeMenu() {
    const addRound = document.getElementById("cs-add-round")!;
    const addWait = document.getElementById("cs-add-wait")!;
    const remove = document.getElementById("cs-remove")!;
    const start = document.getElementById("cs-start")!;
    const stop = document.getElementById("cs-stop")!;

    addRound.addEventListener("click", () => {
      const cs = this.csShown;
      if (!cs || cs.running) return;
      const species = this.spawnableSpeciesNames()[0] ?? "Blob";
      cs.program.push({ kind: "round", species, count: 10 });
      this.csSelectedStep = cs.program.length - 1;
      this.rebuildCreativeProgram();
    });

    addWait.addEventListener("click", () => {
      const cs = this.csShown;
      if (!cs || cs.running) return;
      cs.program.push({ kind: "wait", seconds: 5 });
      this.csSelectedStep = cs.program.length - 1;
      this.rebuildCreativeProgram();
    });

    remove.addEventListener("click", () => {
      const cs = this.csShown;
      if (!cs || cs.running) return;
      if (this.csSelectedStep < 0 || this.csSelectedStep >= cs.program.length) {
        return;
      }
      cs.program.splice(this.csSelectedStep, 1);
      this.csSelectedStep = -1;
      this.rebuildCreativeProgram();
    });

    start.addEventListener("click", () => {
      const cs = this.csShown;
      if (!cs || cs.running || cs.program.length === 0) return;
      cs.start();
      this.rebuildCreativeProgram(); // lock the editors while running
    });

    stop.addEventListener("click", () => {
      const cs = this.csShown;
      if (!cs) return;
      cs.stop();
      this.rebuildCreativeProgram(); // unlock the editors
    });
  }

  /**
   * Reconcile the floating menu with the current selection: show it for a
   * selected Creative Spawner (rebuilding its rows when the target changes),
   * hide it otherwise. Cheap to call often — only rebuilds on a target change.
   */
  private refreshCreativeMenu() {
    const sel = this.game.selected;
    const cs = sel instanceof CreativeSpawner && sel.isAlive ? sel : null;

    if (cs !== this.csShown) {
      this.csShown = cs;
      this.csSelectedStep = -1;
      this.rebuildCreativeProgram();
    }

    this.csMenu.toggleAttribute("hidden", cs === null);
    if (cs) this.updateCreativeProgress();
  }

  /**
   * Rebuild the program rows from scratch — called only on structural changes
   * (target switch, add, remove, start/stop) so it never clobbers a value the
   * user is mid-edit during the periodic progress refresh.
   */
  private rebuildCreativeProgram() {
    const list = this.csProgramEl;
    list.innerHTML = "";
    const cs = this.csShown;
    if (!cs) return;

    if (cs.program.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cs-empty";
      empty.textContent = "No steps yet — add a round or a wait.";
      list.appendChild(empty);
    }

    const speciesNames = this.spawnableSpeciesNames();
    cs.program.forEach((step, i) => {
      const row = document.createElement("div");
      row.className = "cs-row";
      row.dataset.index = String(i);

      const tag = document.createElement("span");
      tag.className = "cs-tag";
      tag.textContent = step.kind === "round" ? "Round" : "Wait";
      row.appendChild(tag);

      if (step.kind === "round") {
        const sel = document.createElement("select");
        for (const name of speciesNames) {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          if (name === step.species) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.disabled = cs.running;
        sel.addEventListener("change", () => {
          step.species = sel.value;
        });
        row.appendChild(sel);

        const count = document.createElement("input");
        count.type = "number";
        count.min = "1";
        count.step = "1";
        count.value = String(step.count);
        count.disabled = cs.running;
        count.addEventListener("change", () => {
          const n = Math.max(1, Math.floor(Number(count.value) || 1));
          step.count = n;
          count.value = String(n);
        });
        row.appendChild(count);
      } else {
        const secs = document.createElement("input");
        secs.type = "number";
        secs.min = "0";
        secs.step = "0.5";
        secs.value = String(step.seconds);
        secs.disabled = cs.running;
        secs.addEventListener("change", () => {
          const n = Math.max(0, Number(secs.value) || 0);
          step.seconds = n;
          secs.value = String(n);
        });
        row.appendChild(secs);

        const unit = document.createElement("span");
        unit.textContent = "s";
        row.appendChild(unit);
      }

      const prog = document.createElement("span");
      prog.className = "cs-prog";
      row.appendChild(prog);

      // Click anywhere on the row (the inputs keep working) selects it for Remove.
      row.addEventListener("click", () => {
        if (cs.running) return; // no editing while running
        this.csSelectedStep = i;
        this.markSelectedRow();
        this.updateCreativeProgress(); // re-enable the Remove button for this pick
      });

      list.appendChild(row);
    });

    this.markSelectedRow();
    this.updateCreativeProgress();
  }

  /** Highlight the row picked for Remove (independent of the live progress). */
  private markSelectedRow() {
    const rows = this.csProgramEl.querySelectorAll<HTMLElement>(".cs-row");
    rows.forEach((row, i) => {
      row.classList.toggle("selected", i === this.csSelectedStep);
    });
  }

  /**
   * Refresh the live bits: status line, per-step progress, the active-step
   * highlight and the enabled/disabled state of the buttons. Does not recreate
   * any rows, so it's safe to call on the periodic stats tick.
   */
  private updateCreativeProgress() {
    const cs = this.csShown;
    if (!cs) return;

    const len = cs.program.length;
    if (cs.running) {
      this.csStatusEl.textContent = `Running — step ${
        cs.stepIndex + 1
      } of ${len}`;
    } else if (len === 0) {
      this.csStatusEl.textContent = "Empty — add rounds and waits, then Start.";
    } else {
      this.csStatusEl.textContent = "Ready — press Start to run.";
    }

    const rows = this.csProgramEl.querySelectorAll<HTMLElement>(".cs-row");
    rows.forEach((row, i) => {
      const active = cs.running && i === cs.stepIndex;
      row.classList.toggle("active", active);
      const prog = row.querySelector<HTMLElement>(".cs-prog");
      if (!prog) return;
      const step = cs.program[i];
      if (cs.running && i < cs.stepIndex) {
        prog.textContent = "✓";
      } else if (active && step) {
        prog.textContent =
          step.kind === "round"
            ? `${cs.spawnedInStep}/${step.count}`
            : `${cs.stepElapsed.toFixed(1)}/${step.seconds}s`;
      } else {
        prog.textContent = "";
      }
    });

    const setDisabled = (id: string, disabled: boolean) => {
      (document.getElementById(id) as HTMLButtonElement).disabled = disabled;
    };
    setDisabled("cs-add-round", cs.running);
    setDisabled("cs-add-wait", cs.running);
    setDisabled("cs-remove", cs.running || this.csSelectedStep < 0);
    setDisabled("cs-start", cs.running || len === 0);
    setDisabled("cs-stop", !cs.running);
  }
}
