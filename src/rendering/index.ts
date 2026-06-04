import type { World } from "../core/world";
import type { Vec2 } from "../utils/math";
import { EntityKind } from "../entities/entity";
import { Creature } from "../entities/creature";
import { Food } from "../entities/food";
import { SpawnerTower } from "../entities/spawner";
import { BuffEntity, BUFF_CONFIGS, BuffType } from "../entities/buffs";
import { EditorMode, type PendingPlacement } from "../ui/mode";
import { SPECIES } from "../core/config";

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;

  // Camera
  cameraX = 0;
  cameraY = 0;
  zoom = 1;

  // Interaction state
  selectedEntityId: number | null = null;
  hoveredEntityId: number | null = null;
  gameSpeed = 1;

  // Editor mode
  editorMode: EditorMode = EditorMode.Select;

  // Placement preview (Place mode)
  placementPreview: PendingPlacement | null = null;
  cursorWorldPos: Vec2 = { x: 0, y: 0 };

  // Pan state
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartCamX = 0;
  private panStartCamY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    this.setupInput();
    this.updateCursor();
  }

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // ── Coordinate transforms ──

  worldToScreen(wx: number, wy: number): Vec2 {
    return {
      x: (wx - this.cameraX) * this.zoom + this.width / 2,
      y: (wy - this.cameraY) * this.zoom + this.height / 2,
    };
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return {
      x: (sx - this.width / 2) / this.zoom + this.cameraX,
      y: (sy - this.height / 2) / this.zoom + this.cameraY,
    };
  }

  // ── Cursor ──

  private updateCursor(): void {
    switch (this.editorMode) {
      case EditorMode.Select:
        this.canvas.style.cursor = "default";
        break;
      case EditorMode.Place:
        this.canvas.style.cursor = "crosshair";
        break;
      case EditorMode.Move:
        this.canvas.style.cursor = "grab";
        break;
      case EditorMode.Delete:
        this.canvas.style.cursor = "not-allowed";
        break;
    }
  }

  setEditorMode(mode: EditorMode): void {
    this.editorMode = mode;
    this.updateCursor();
  }

  // ── Input ──

  private setupInput(): void {
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const worldBefore = this.screenToWorld(e.clientX, e.clientY);
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom = Math.max(0.1, Math.min(3, this.zoom * zoomFactor));
      const worldAfter = this.screenToWorld(e.clientX, e.clientY);
      this.cameraX += worldBefore.x - worldAfter.x;
      this.cameraY += worldBefore.y - worldAfter.y;
    });

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 1 || e.button === 2) {
        // Middle or right click: pan (always works)
        e.preventDefault();
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panStartCamX = this.cameraX;
        this.panStartCamY = this.cameraY;
      }
      // Left-click is handled externally in main.ts (mode-dependent)
    });

    window.addEventListener("mousemove", (e) => {
      // Track cursor world position
      this.cursorWorldPos = this.screenToWorld(e.clientX, e.clientY);

      if (this.isPanning) {
        const dx = e.clientX - this.panStartX;
        const dy = e.clientY - this.panStartY;
        this.cameraX = this.panStartCamX - dx / this.zoom;
        this.cameraY = this.panStartCamY - dy / this.zoom;
      }
    });

    window.addEventListener("mouseup", () => {
      this.isPanning = false;
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  // ── Main render ──

  render(world: World): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid(world);
    this.drawEntities(world);
    this.drawPlacementPreview();
    this.drawUIOverlay();
  }

  private drawGrid(world: World): void {
    const ctx = this.ctx;
    const gridSize = 100;

    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 1;

    const startX =
      Math.floor(this.cameraX - this.width / 2 / this.zoom / gridSize) *
      gridSize;
    const startY =
      Math.floor(this.cameraY - this.height / 2 / this.zoom / gridSize) *
      gridSize;
    const endX = startX + this.width / this.zoom + gridSize * 2;
    const endY = startY + this.height / this.zoom + gridSize * 2;

    for (let x = startX; x <= endX; x += gridSize) {
      const sx = this.worldToScreen(x, 0).x;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, this.height);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSize) {
      const sy = this.worldToScreen(0, y).y;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(this.width, sy);
      ctx.stroke();
    }

    // Arena border
    ctx.strokeStyle = "#4a4a6a";
    ctx.lineWidth = 2;
    const topLeft = this.worldToScreen(0, 0);
    const bottomRight = this.worldToScreen(world.arenaWidth, world.arenaHeight);
    ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y,
    );
  }

  private drawEntities(world: World): void {
    const entities = [...world.entities].sort((a, b) => {
      const order: Record<string, number> = {
        [EntityKind.Food]: 1,
        [EntityKind.Buff]: 1,
        [EntityKind.Spawner]: 2,
        [EntityKind.Creature]: 3,
      };
      return (order[a.kind] ?? 0) - (order[b.kind] ?? 0);
    });

    for (const e of entities) {
      if (e.kind === EntityKind.Creature) {
        this.drawCreature(e as Creature);
      } else if (e.kind === EntityKind.Food) {
        this.drawFood(e as Food);
      } else if (e.kind === EntityKind.Spawner) {
        this.drawSpawner(e as SpawnerTower);
      } else if (e.kind === EntityKind.Buff) {
        this.drawBuff(e as BuffEntity);
      }

      // Delete-mode hover highlight
      if (
        this.editorMode === EditorMode.Delete &&
        e.id === this.hoveredEntityId
      ) {
        const sp = this.worldToScreen(e.position.x, e.position.y);
        const r = (e.radius + 4) * this.zoom;
        this.ctx.save();
        this.ctx.strokeStyle = "#ef4444";
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = "#ef4444";
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        this.ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // Selected indicator
    if (this.selectedEntityId != null) {
      const selected = world.entities.find(
        (e) => e.id === this.selectedEntityId,
      );
      if (selected) {
        const sp = this.worldToScreen(selected.position.x, selected.position.y);
        const ctx = this.ctx;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, selected.radius * this.zoom + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ── Placement ghost preview ──

  private drawPlacementPreview(): void {
    if (!this.placementPreview || this.editorMode !== EditorMode.Place) return;

    const p = this.placementPreview;
    const sp = this.worldToScreen(this.cursorWorldPos.x, this.cursorWorldPos.y);
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = 0.5;

    let radius: number;
    let color: string;

    switch (p.kind) {
      case "creature": {
        const cfg = SPECIES[p.species];
        radius = cfg.radius;
        color = cfg.color;
        break;
      }
      case "food": {
        radius = 7;
        color = p.foodType === "fuel" ? "#4ade80" : "#ef4444";
        break;
      }
      case "buff": {
        radius = 12;
        color = BUFF_CONFIGS[p.buffType].color;
        break;
      }
      case "spawner": {
        radius = 22;
        color = SPECIES[p.species].color;
        break;
      }
      default:
        ctx.restore();
        return;
    }

    const r = radius * this.zoom;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;

    // Draw as circle for preview
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crosshair
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    const cr = r + 8;
    ctx.beginPath();
    ctx.moveTo(sp.x - cr, sp.y);
    ctx.lineTo(sp.x + cr, sp.y);
    ctx.moveTo(sp.x, sp.y - cr);
    ctx.lineTo(sp.x, sp.y + cr);
    ctx.stroke();

    ctx.restore();
  }

  // ── Creature drawing ──

  private drawCreature(creature: Creature): void {
    const ctx = this.ctx;
    const sp = this.worldToScreen(creature.position.x, creature.position.y);
    const r = creature.radius * this.zoom;

    if (r < 2 && creature.id !== this.selectedEntityId) return;

    ctx.save();
    ctx.translate(sp.x, sp.y);

    // Shield glow
    if (creature.isInvulnerable) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Speed trail
    if (creature.isSpedUp) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,191,36,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Dagger glow
    if (creature.activeBuffs.has(BuffType.Dagger)) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(244,63,94,0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Body
    ctx.fillStyle = creature.color;
    ctx.strokeStyle = creature.accentColor;
    ctx.lineWidth = 1.5;

    switch (creature.shape) {
      case "circle":
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case "square":
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        break;

      case "triangle": {
        ctx.beginPath();
        const h = r * 1.8;
        ctx.moveTo(0, -h);
        ctx.lineTo(r * 1.5, r);
        ctx.lineTo(-r * 1.5, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case "spiky": {
        ctx.beginPath();
        const spikes = 7;
        const outerR = r;
        const innerR = r * 0.55;
        for (let i = 0; i < spikes * 2; i++) {
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const radius = i % 2 === 0 ? outerR : innerR;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }

    // Eyes
    if (creature.shape === "circle" && r > 6) {
      const eyeOff = r * 0.35;
      const eyeR = Math.max(1, r * 0.18);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(-eyeOff, -eyeOff * 0.5, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeOff, -eyeOff * 0.5, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(-eyeOff, -eyeOff * 0.5, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeOff, -eyeOff * 0.5, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Bars
    if (r > 8) {
      this.drawBars(creature, sp, r);
    }
    if (r > 12) {
      this.drawActionText(creature, sp, r);
    }
  }

  private drawBars(creature: Creature, sp: Vec2, r: number): void {
    const ctx = this.ctx;
    const barWidth = r * 2.2;
    const barHeight = Math.max(2, r * 0.2);
    const barY = sp.y - r - barHeight * 2 - 4;

    const healthFrac = creature.health / creature.maxHealth;
    ctx.fillStyle = "#333";
    ctx.fillRect(sp.x - barWidth / 2, barY, barWidth, barHeight);
    ctx.fillStyle =
      healthFrac > 0.5 ? "#4ade80" : healthFrac > 0.25 ? "#fbbf24" : "#ef4444";
    ctx.fillRect(sp.x - barWidth / 2, barY, barWidth * healthFrac, barHeight);

    if (creature.energy !== Infinity) {
      const eBarY = barY + barHeight + 1;
      const energyFrac = creature.energy / creature.maxEnergy;
      ctx.fillStyle = "#333";
      ctx.fillRect(sp.x - barWidth / 2, eBarY, barWidth, barHeight);
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(
        sp.x - barWidth / 2,
        eBarY,
        barWidth * energyFrac,
        barHeight,
      );
    }
  }

  private drawActionText(creature: Creature, sp: Vec2, r: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `${Math.max(9, r * 0.5)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(creature.currentAction, sp.x, sp.y - r - 18);
  }

  private drawFood(food: Food): void {
    const ctx = this.ctx;
    const sp = this.worldToScreen(food.position.x, food.position.y);
    const r = food.radius * this.zoom;
    if (r < 1) return;

    if (food.foodType === "fuel") {
      ctx.fillStyle = "#4ade80";
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#166534";
      ctx.lineWidth = 1;
      const inner = r * 0.4;
      ctx.beginPath();
      ctx.moveTo(sp.x - inner, sp.y);
      ctx.lineTo(sp.x + inner, sp.y);
      ctx.moveTo(sp.x, sp.y - inner);
      ctx.lineTo(sp.x, sp.y + inner);
      ctx.stroke();
    } else {
      this.drawHeart(sp.x, sp.y, r * 2, "#ef4444", "#dc2626");
    }
  }

  private drawHeart(
    cx: number,
    cy: number,
    size: number,
    fill: string,
    stroke: string,
  ): void {
    const ctx = this.ctx;
    const s = size * 0.35;
    ctx.save();
    ctx.translate(cx, cy - s * 0.2);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.6);
    ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s * 1.2, 0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.5, -s * 1.2, s, -s * 0.3, 0, s * 0.6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawSpawner(spawner: SpawnerTower): void {
    const ctx = this.ctx;
    const sp = this.worldToScreen(spawner.position.x, spawner.position.y);
    const r = spawner.radius * this.zoom;
    if (r < 2) return;

    ctx.fillStyle = "#475569";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.fillRect(sp.x - r, sp.y - r, r * 2, r * 2);
    ctx.strokeRect(sp.x - r, sp.y - r, r * 2, r * 2);

    ctx.fillStyle = "#334155";
    ctx.fillRect(sp.x - r * 0.6, sp.y - r * 0.6, r * 1.2, r * 1.2);

    if (r > 10) {
      const hpFrac = spawner.health / spawner.maxHealth;
      const barW = r * 2;
      const barH = Math.max(2, r * 0.3);
      const barY = sp.y - r - barH - 2;
      ctx.fillStyle = "#333";
      ctx.fillRect(sp.x - barW / 2, barY, barW, barH);
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(sp.x - barW / 2, barY, barW * hpFrac, barH);
    }
  }

  private drawBuff(buff: BuffEntity): void {
    const ctx = this.ctx;
    const sp = this.worldToScreen(buff.position.x, buff.position.y);
    const r = buff.radius * this.zoom;
    if (r < 1) return;

    const cfg = BUFF_CONFIGS[buff.buffType];
    ctx.fillStyle = cfg.color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y - r);
    ctx.lineTo(sp.x + r, sp.y);
    ctx.lineTo(sp.x, sp.y + r);
    ctx.lineTo(sp.x - r, sp.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (r > 12) {
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(8, r * 0.45)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(cfg.label, sp.x, sp.y + r + 14);
    }
  }

  private drawUIOverlay(): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px monospace";
    ctx.textAlign = "right";

    const speedText = this.gameSpeed === 0 ? "PAUSED" : `${this.gameSpeed}x`;
    const modeLabel =
      this.editorMode.charAt(0).toUpperCase() + this.editorMode.slice(1);
    const color = this.gameSpeed === 0 ? "#fbbf24" : "#e2e8f0";
    ctx.fillStyle = color;
    ctx.fillText(
      `${speedText} | ${modeLabel} | Zoom: ${this.zoom.toFixed(1)}x`,
      this.width - 12,
      this.height - 12,
    );
  }
}
