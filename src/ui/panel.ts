import type { Game } from "../core/game";
import { getSpeciesList, getSpecies } from "../entities/creatures/registry";
import { Food } from "../entities/food";
import { Creature } from "../entities/creature";
import type { Entity } from "../entities/entity";
import { Vec2, randomInRect, distance } from "../utils/vec2";

export class Panel {
  private deleteMode = false;

  constructor(private game: Game) {
    this.populateSpeciesSelect();
    this.bindButtons();
    this.bindSpeedControls();
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
    const spawnCreature10Btn = document.getElementById(
      "spawn-creature-10-btn",
    )!;
    const spawnFoodBtn = document.getElementById("spawn-food-btn")!;
    const spawnFood100Btn = document.getElementById("spawn-food-100-btn")!;
    const deleteModeBtn = document.getElementById("delete-mode-btn")!;
    const select = document.getElementById(
      "species-select",
    ) as HTMLSelectElement;
    const canvas = document.getElementById("game") as HTMLCanvasElement;

    const spawnCreature = () => {
      const speciesName = select.value;
      const species = getSpecies(speciesName);
      if (!species) return;
      const pos = randomInRect(
        100,
        100,
        this.game.arena.width - 200,
        this.game.arena.height - 200,
      );
      this.game.addEntity(species.create(pos));
    };

    spawnCreatureBtn.addEventListener("click", spawnCreature);

    spawnCreature10Btn.addEventListener("click", () => {
      for (let i = 0; i < 10; i++) spawnCreature();
    });

    spawnFoodBtn.addEventListener("click", () => {
      for (let i = 0; i < 10; i++) {
        const pos = randomInRect(
          50,
          50,
          this.game.arena.width - 100,
          this.game.arena.height - 100,
        );
        this.game.addEntity(new Food(pos));
      }
    });

    spawnFood100Btn.addEventListener("click", () => {
      for (let i = 0; i < 100; i++) {
        const pos = randomInRect(
          50,
          50,
          this.game.arena.width - 100,
          this.game.arena.height - 100,
        );
        this.game.addEntity(new Food(pos));
      }
    });

    deleteModeBtn.addEventListener("click", () => {
      this.deleteMode = !this.deleteMode;
      deleteModeBtn.textContent = `Delete Mode: ${this.deleteMode ? "ON" : "OFF"}`;
      deleteModeBtn.classList.toggle("active", this.deleteMode);
      canvas.classList.toggle("deleting", this.deleteMode);
    });

    // Wire up click handler for delete
    this.game.input.onClick = (worldPos: Vec2) => {
      if (!this.deleteMode) return;
      // Find closest creature to click
      for (const e of this.game.entities) {
        if (e instanceof Creature && e.isAlive) {
          if (distance(worldPos, e.position) < e.radius + 5) {
            e.isAlive = false;
            e.deathTime = performance.now();
            break;
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
        this.game.simSpeed = speed;
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
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

    const byCounts = new Map<string, number>();
    for (const c of creatures) {
      if (c instanceof Creature) {
        byCounts.set(c.species, (byCounts.get(c.species) ?? 0) + 1);
      }
    }

    let html = `Creatures: ${creatures.length} &nbsp;|&nbsp; Food: ${food.length}<br>`;
    for (const [name, count] of byCounts) {
      html += `${name}: ${count} &nbsp; `;
    }
    statsEl.innerHTML = html;
  }
}
