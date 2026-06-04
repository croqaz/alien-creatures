import type { World } from "../core/world";
import type { Renderer } from "../rendering/index";
import { Creature, CreatureSpecies } from "../entities/creature";
import { Food } from "../entities/food";
import { SpawnerTower } from "../entities/spawner";
import { BuffEntity, BuffType } from "../entities/buffs";
import {
  SPECIES,
  SPAWNER_DEFAULT_INTERVAL,
  SPAWNER_MIN_INTERVAL,
} from "../core/config";
import { rand } from "../utils/math";
import type { Vec2 } from "../utils/math";
import { getBehavioursForSpecies } from "../behaviours/index";
import { EditorMode, type PendingPlacement } from "./mode";

export { EditorMode };
export type { PendingPlacement };

export class UIPanel {
  private panel: HTMLElement;
  private statsDiv!: HTMLElement;
  private world!: World;
  private renderer!: Renderer;
  selectedCreature: Creature | null = null;
  private spawnSlider!: HTMLInputElement;

  // ── Mode state ──
  private _mode: EditorMode = EditorMode.Select;
  private modeButtons: Map<EditorMode, HTMLButtonElement> = new Map();
  pendingPlacement: PendingPlacement | null = null;

  /** Callback when the user switches mode */
  onModeChange: ((mode: EditorMode) => void) | null = null;

  constructor() {
    this.panel = document.getElementById("ui-panel")!;
    this.buildPanel();
  }

  get mode(): EditorMode {
    return this._mode;
  }

  setMode(mode: EditorMode): void {
    this._mode = mode;
    this.pendingPlacement = null;
    this.updateModeButtons();
    this.onModeChange?.(mode);
  }

  setWorld(world: World): void {
    this.world = world;
    if (this.spawnSlider) {
      this.spawnSlider.value = String(world.spawnerInterval);
    }
  }

  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  setSelectedCreature(creature: Creature | null): void {
    this.selectedCreature = creature;
    if (this.renderer) {
      this.renderer.selectedEntityId = creature?.id ?? null;
    }
    this.updateStats();
  }

  private buildPanel(): void {
    while (this.panel.firstChild) {
      this.panel.removeChild(this.panel.firstChild);
    }

    const title = document.createElement("h2");
    title.textContent = "Alien Creatures";
    this.panel.appendChild(title);

    // ── Mode toggles ──
    const modeSection = document.createElement("div");
    modeSection.className = "section mode-bar";

    const modes: { mode: EditorMode; label: string; title: string }[] = [
      {
        mode: EditorMode.Select,
        label: "🖐 Select",
        title: "Click creatures to inspect",
      },
      {
        mode: EditorMode.Place,
        label: "📍 Place",
        title: "Pick a spawn button, then click the arena",
      },
      {
        mode: EditorMode.Move,
        label: "✋ Move",
        title: "Drag creatures to reposition",
      },
      {
        mode: EditorMode.Delete,
        label: "🗑 Delete",
        title: "Click creatures to remove",
      },
    ];

    for (const { mode, label, title } of modes) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.title = title;
      btn.className = "mode-btn";
      btn.addEventListener("click", () => this.setMode(mode));
      this.modeButtons.set(mode, btn);
      modeSection.appendChild(btn);
    }
    this.panel.appendChild(modeSection);

    // ── Creature spawn buttons ──
    const creatureSection = document.createElement("div");
    creatureSection.className = "section";
    creatureSection.innerHTML = "<h3>Creatures</h3>";
    const speciesList: CreatureSpecies[] = [
      "blob",
      "floater",
      "crawler",
      "defender",
      "lurker",
      "spiker",
    ];
    for (const sp of speciesList) {
      const cfg = SPECIES[sp];
      const btn = document.createElement("button");
      btn.className = "spawn-btn";
      btn.style.backgroundColor = cfg.color;
      btn.style.color = "#111";
      btn.textContent = `${sp} (${cfg.isAggressive ? "⚔" : "☮"})`;
      btn.title = `Spawn ${sp}: HP ${cfg.maxHealth} | Energy ${cfg.maxEnergy} | Speed ${cfg.maxSpeed}`;
      btn.addEventListener("click", () =>
        this.requestSpawn({ kind: "creature", species: sp }),
      );
      creatureSection.appendChild(btn);
    }
    this.panel.appendChild(creatureSection);

    // ── Object spawn buttons ──
    const objSection = document.createElement("div");
    objSection.className = "section";
    objSection.innerHTML = "<h3>Objects</h3>";

    const fuelBtn = document.createElement("button");
    fuelBtn.className = "spawn-btn";
    fuelBtn.style.backgroundColor = "#4ade80";
    fuelBtn.textContent = "⛽ Fuel";
    fuelBtn.addEventListener("click", () =>
      this.requestSpawn({ kind: "food", foodType: "fuel" }),
    );
    objSection.appendChild(fuelBtn);

    const heartBtn = document.createElement("button");
    heartBtn.className = "spawn-btn";
    heartBtn.style.backgroundColor = "#ef4444";
    heartBtn.textContent = "❤ Heart";
    heartBtn.addEventListener("click", () =>
      this.requestSpawn({ kind: "food", foodType: "health" }),
    );
    objSection.appendChild(heartBtn);

    this.panel.appendChild(objSection);

    // ── Buff spawn buttons ──
    const buffSection = document.createElement("div");
    buffSection.className = "section";
    buffSection.innerHTML = "<h3>Buffs</h3>";

    const buffTypes: { type: BuffType; label: string; color: string }[] = [
      { type: BuffType.Shield, label: "🛡 Shield", color: "#e2e8f0" },
      { type: BuffType.Speed, label: "⚡ Speed", color: "#fbbf24" },
      { type: BuffType.Dagger, label: "🗡 Dagger", color: "#f43f5e" },
    ];
    for (const bt of buffTypes) {
      const btn = document.createElement("button");
      btn.className = "spawn-btn";
      btn.style.backgroundColor = bt.color;
      btn.style.color = "#111";
      btn.textContent = bt.label;
      btn.addEventListener("click", () =>
        this.requestSpawn({ kind: "buff", buffType: bt.type }),
      );
      buffSection.appendChild(btn);
    }
    this.panel.appendChild(buffSection);

    // ── Spawner tower buttons ──
    const spawnerSection = document.createElement("div");
    spawnerSection.className = "section";
    spawnerSection.innerHTML = "<h3>Spawner Towers</h3>";
    for (const sp of speciesList) {
      const cfg = SPECIES[sp];
      const btn = document.createElement("button");
      btn.className = "spawn-btn";
      btn.style.backgroundColor = cfg.color;
      btn.style.color = "#111";
      btn.textContent = `Tower [${sp}]`;
      btn.title = `Spawn ${sp} spawner tower (HP: 5000)`;
      btn.addEventListener("click", () =>
        this.requestSpawn({ kind: "spawner", species: sp }),
      );
      spawnerSection.appendChild(btn);
    }
    this.panel.appendChild(spawnerSection);

    // ── Spawn rate slider ──
    const rateSection = document.createElement("div");
    rateSection.className = "section";
    rateSection.innerHTML = "<h3>Spawn Rate</h3>";

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "slider-container";

    const label = document.createElement("span");
    label.id = "spawn-rate-label";
    label.textContent = "1 / 5s";

    this.spawnSlider = document.createElement("input");
    this.spawnSlider.type = "range";
    this.spawnSlider.min = String(SPAWNER_MIN_INTERVAL);
    this.spawnSlider.max = String(SPAWNER_DEFAULT_INTERVAL);
    this.spawnSlider.value = String(SPAWNER_DEFAULT_INTERVAL);
    this.spawnSlider.addEventListener("input", () => {
      const val = parseInt(this.spawnSlider.value);
      if (this.world) {
        this.world.spawnerInterval = val;
      }
      const perSec = val > 0 ? (1000 / val).toFixed(1) : "…";
      label.textContent = `${perSec}/s`;
    });

    sliderContainer.appendChild(this.spawnSlider);
    sliderContainer.appendChild(label);
    rateSection.appendChild(sliderContainer);
    this.panel.appendChild(rateSection);

    // ── Stats ──
    this.statsDiv = document.createElement("div");
    this.statsDiv.className = "stats";
    this.panel.appendChild(this.statsDiv);

    // ── Controls help ──
    const helpSection = document.createElement("div");
    helpSection.className = "section";
    helpSection.innerHTML = `
      <h3>Controls</h3>
      <p style="font-size:11px;color:#aaa;">
        1-4: Speed | Space: Pause<br>
        Scroll: Zoom | Right-drag: Pan<br>
        Mode: Select·Place·Move·Delete
      </p>`;
    this.panel.appendChild(helpSection);

    this.updateModeButtons();
    this.updateStats();
  }

  // ── Mode button visuals ──

  private updateModeButtons(): void {
    for (const [mode, btn] of this.modeButtons) {
      if (mode === this._mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  }

  // ── Spawn request ──

  /**
   * Called when the user clicks a spawn button.
   * In Place mode: sets pending placement for exact arena click.
   * In other modes: spawns immediately at a random visible position.
   */
  private requestSpawn(placement: PendingPlacement): void {
    if (this._mode === EditorMode.Place) {
      this.pendingPlacement = placement;
      this.updateStats(); // refresh stats to show pending
    } else {
      this.spawnAtRandom(placement);
    }
  }

  /** Spawn the given placement at a random position in the current viewport */
  spawnAtViewport(worldPos: Vec2): void {
    if (!this.pendingPlacement || !this.world) return;
    const placement = this.pendingPlacement;
    this.pendingPlacement = null;
    this.doSpawn(placement, worldPos);
  }

  private spawnAtRandom(placement: PendingPlacement): void {
    const pos = this.getSpawnPos();
    this.doSpawn(placement, pos);
  }

  private doSpawn(placement: PendingPlacement, pos: Vec2): void {
    if (!this.world) return;
    switch (placement.kind) {
      case "creature": {
        const creature = new Creature(placement.species, pos);
        creature.behaviours = getBehavioursForSpecies(placement.species);
        this.world.spawn(creature);
        this.setSelectedCreature(creature);
        break;
      }
      case "food":
        this.world.spawn(new Food(pos, placement.foodType));
        break;
      case "buff":
        this.world.spawn(new BuffEntity(pos, placement.buffType));
        break;
      case "spawner":
        this.world.spawn(new SpawnerTower(pos, placement.species));
        break;
    }
  }

  private getSpawnPos(): Vec2 {
    if (!this.renderer) return { x: 500, y: 500 };
    return {
      x: this.renderer.cameraX + rand(-100, 100),
      y: this.renderer.cameraY + rand(-100, 100),
    };
  }

  // ── Stats display ──

  updateStats(): void {
    if (!this.statsDiv) return;

    // Show pending placement hint
    if (this.pendingPlacement) {
      const p = this.pendingPlacement;
      let label = "";
      switch (p.kind) {
        case "creature":
          label = `${p.species} creature`;
          break;
        case "food":
          label = p.foodType;
          break;
        case "buff":
          label = p.buffType;
          break;
        case "spawner":
          label = `${p.species} spawner`;
          break;
      }
      this.statsDiv.innerHTML = `<span style="color:#fbbf24;">📍 Placing: ${label}<br>Click the arena…</span>`;
      return;
    }

    if (!this.selectedCreature) {
      this.statsDiv.innerHTML =
        '<span class="dim">Click a creature to select</span>';
      return;
    }
    const c = this.selectedCreature;
    const cfg = SPECIES[c.species];
    const buffs = Array.from(c.activeBuffs.keys()).join(", ") || "none";

    this.statsDiv.innerHTML = `
      <div class="stat-row"><strong>${c.species}</strong> ${cfg.isAggressive ? "⚔" : "☮"}</div>
      <div class="stat-row">HP: ${c.health.toFixed(0)} / ${c.maxHealth}</div>
      <div class="stat-row">Energy: ${c.energy === Infinity ? "∞" : c.energy.toFixed(0) + " / " + c.maxEnergy}</div>
      <div class="stat-row">Speed: ${c.speed}</div>
      <div class="stat-row">Damage: ${c.effectiveDamage} | Retal: ${c.effectiveRetaliation}</div>
      <div class="stat-row">Buffs: ${buffs}</div>
      <div class="stat-row">Faction: ${c.faction ?? "none"}</div>
      <div class="stat-row action">${c.currentAction}</div>
    `;
  }
}
