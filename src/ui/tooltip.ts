import type { World } from "../core/world";
import type { Renderer } from "../rendering/index";
import { Creature } from "../entities/creature";
import { Food } from "../entities/food";
import { SpawnerTower } from "../entities/spawner";
import { BuffEntity, BUFF_CONFIGS } from "../entities/buffs";
import { EntityKind } from "../entities/entity";
import { vecDist } from "../utils/math";

export class Tooltip {
  private el: HTMLElement;
  private world: World | null = null;
  private renderer: Renderer | null = null;

  constructor() {
    this.el = document.getElementById("tooltip")!;
    // Use the canvas from DOM directly — renderer may not be set yet
    const canvas = document.getElementById("game") as HTMLCanvasElement;
    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      this.onMouseMove(e.clientX, e.clientY);
    });
    canvas.addEventListener("mouseleave", () => {
      this.hide();
    });
  }

  setWorld(world: World): void {
    this.world = world;
  }

  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  private onMouseMove(mx: number, my: number): void {
    if (!this.world || !this.renderer) return;

    const worldPos = this.renderer.screenToWorld(mx, my);
    const entities = this.world.entities;
    let closest: {
      entity: import("../entities/entity").Entity;
      dist: number;
    } | null = null;

    for (const e of entities) {
      const dist = vecDist(worldPos, e.position);
      const range = e.radius + 10;
      if (dist <= range) {
        if (!closest || dist < closest.dist) {
          closest = { entity: e, dist };
        }
      }
    }

    if (closest) {
      const text = this.getEntityText(closest.entity);
      this.show(mx + 16, my + 16, text);
    } else {
      this.hide();
    }
  }

  private getEntityText(entity: import("../entities/entity").Entity): string {
    switch (entity.kind) {
      case EntityKind.Creature: {
        const c = entity as Creature;
        const buffs = Array.from(c.activeBuffs.keys()).join(", ") || "none";
        return [
          `${c.species} ${c.isAggressive ? "⚔" : "☮"}`,
          `HP: ${c.health === Infinity ? "∞" : c.health.toFixed(0)} / ${c.maxHealth}`,
          `Energy: ${c.energy === Infinity ? "∞" : c.energy.toFixed(0)} / ${c.maxEnergy}`,
          `Dmg: ${c.effectiveDamage} | Ret: ${c.effectiveRetaliation}`,
          `Buffs: ${buffs}`,
          `Faction: ${c.faction ?? "none"}`,
          c.currentAction,
        ].join("\n");
      }
      case EntityKind.Food: {
        const f = entity as Food;
        return `${f.foodType === "fuel" ? "⛽ Fuel" : "❤ Heart"}\nRestores: ${f.value}`;
      }
      case EntityKind.Spawner: {
        const s = entity as SpawnerTower;
        return `Spawner [${s.spawnSpecies}]\nHP: ${s.health} / ${s.maxHealth}\nFaction: ${s.faction}`;
      }
      case EntityKind.Buff: {
        const b = entity as BuffEntity;
        const cfg = BUFF_CONFIGS[b.buffType];
        return `${cfg.label}\nDuration: ${b.duration}s`;
      }
      default:
        return "Unknown entity";
    }
  }

  private show(x: number, y: number, text: string): void {
    this.el.style.display = "block";
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.textContent = text;
  }

  private hide(): void {
    this.el.style.display = "none";
  }
}
