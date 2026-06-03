import type { Game } from "../core/game";
import { getSpeciesList, getSpecies } from "../entities/creatures/registry";
import { Food } from "../entities/food";
import { Heart } from "../entities/heart";
import { Creature } from "../entities/creature";
import type { Entity } from "../entities/entity";
import { Vec2, randomInRect, distance } from "../utils/vec2";

export class Panel {
  private deleteMode = false;
  private wallMode = false;
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

  private populateSpeciesSelect() {
    const select = document.getElementById(
      "species-select",
    ) as HTMLSelectElement;
    for (const species of getSpeciesList()) {
      const opt = document.createElement("option");
      opt.value = species.name;
      opt.textContent = `${species.name} — ${species.description}`;
      select.appendChild(opt);
    }
  }

  private bindButtons() {
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
    const deleteModeBtn = document.getElementById("delete-mode-btn")!;
    const wallModeBtn = document.getElementById("wall-mode-btn")!;
    const select = document.getElementById(
      "species-select",
    ) as HTMLSelectElement;
    const canvas = document.getElementById("game") as HTMLCanvasElement;

    const refreshModeButtons = () => {
      deleteModeBtn.textContent = `Delete Mode: ${this.deleteMode ? "ON" : "OFF"}`;
      deleteModeBtn.classList.toggle("active", this.deleteMode);
      wallModeBtn.textContent = `Walls Mode: ${this.wallMode ? "ON" : "OFF"}`;
      wallModeBtn.classList.toggle("active", this.wallMode);
      canvas.classList.toggle("deleting", this.deleteMode);
      canvas.classList.toggle("building", this.wallMode);
    };

    const spawnCreature = () => {
      const speciesName = select.value;
      const species = getSpecies(speciesName);
      if (!species) return;
      this.game.addEntity(species.create(this.randomFreePos(100, 24)));
    };

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
      const n = Number(creatureCount.value);
      for (let i = 0; i < n; i++) spawnCreature();
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

    deleteModeBtn.addEventListener("click", () => {
      this.deleteMode = !this.deleteMode;
      if (this.deleteMode) this.wallMode = false; // modes are mutually exclusive
      refreshModeButtons();
    });

    wallModeBtn.addEventListener("click", () => {
      this.wallMode = !this.wallMode;
      if (this.wallMode) this.deleteMode = false; // modes are mutually exclusive
      refreshModeButtons();
    });

    // Wire up the left-click/drag handler for placing walls and deleting.
    this.game.input.onClick = (worldPos: Vec2) => {
      if (this.wallMode) {
        this.game.walls.placeAt(worldPos);
        // Remove any food/hearts now buried in the wall so nothing chases the unreachable.
        for (const e of this.game.entities) {
          if (
            (e instanceof Food || e instanceof Heart) &&
            e.isAlive &&
            this.game.walls.overlaps(e.position, e.radius)
          ) {
            e.isAlive = false;
          }
        }
        return;
      }
      if (this.deleteMode) {
        // Remove a wall under the cursor, otherwise the closest creature.
        if (this.game.walls.removeAt(worldPos)) return;
        for (const e of this.game.entities) {
          if (e instanceof Creature && e.isAlive) {
            if (distance(worldPos, e.position) < e.radius + 5) {
              e.isAlive = false;
              e.deathTime = performance.now();
              break;
            }
          }
        }
      }
    };
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
    const creatures = this.game.entities.filter(
      (e: Entity) => e instanceof Creature && e.isAlive,
    );
    const food = this.game.entities.filter(
      (e: Entity) => e instanceof Food && e.isAlive,
    );
    const hearts = this.game.entities.filter(
      (e: Entity) => e instanceof Heart && e.isAlive,
    );

    const byCounts = new Map<string, number>();
    for (const c of creatures) {
      if (c instanceof Creature) {
        byCounts.set(c.species, (byCounts.get(c.species) ?? 0) + 1);
      }
    }

    let html = `Creatures: ${creatures.length} &nbsp;|&nbsp; Food: ${food.length} &nbsp;|&nbsp; Hearts: ${hearts.length}<br>`;
    for (const [name, count] of byCounts) {
      html += `${name}: ${count} &nbsp; `;
    }
    statsEl.innerHTML = html;
  }
}
