import { Camera } from "../core/camera";
import { Arena } from "../core/arena";
import { Entity } from "../entities/entity";
import { Creature } from "../entities/creature";
import { Spawner } from "../entities/spawner";
import { Food } from "../entities/food";
import { Heart } from "../entities/heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "../entities/powerup";
import { Fireball } from "../entities/fireball";
import { Wall } from "../entities/wall";
import { drawCreature } from "./creature-renderer";
import { drawSpawner } from "./spawner-renderer";
import { drawFood } from "./food-renderer";
import { drawHeart } from "./heart-renderer";
import { drawFireball } from "./fireball-renderer";
import {
  drawShieldPowerup,
  drawSpeedPowerup,
  drawSwordPowerup,
} from "./powerup-renderer";

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private arena: Arena,
  ) {}

  render(entities: Entity[], walls: Wall[], time: number) {
    const { ctx, canvas, camera } = this;

    // Resize canvas to viewport
    if (
      canvas.width !== canvas.clientWidth ||
      canvas.height !== canvas.clientHeight
    ) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply camera
    camera.applyTransform(ctx);

    // Draw arena
    this.arena.draw(ctx);

    // Draw walls (beneath food and creatures)
    for (const w of walls) {
      const x = w.position.x - w.size / 2;
      const y = w.position.y - w.size / 2;
      ctx.fillStyle = "#3a3a52";
      ctx.fillRect(x, y, w.size, w.size);
      ctx.strokeStyle = "#5a5a7a";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w.size - 2, w.size - 2);
    }

    // Sort: pickups (food/hearts) first, then creatures (so creatures draw on top)
    const foods: Food[] = [];
    const hearts: Heart[] = [];
    const shields: ShieldPowerup[] = [];
    const speeds: SpeedPowerup[] = [];
    const swords: SwordPowerup[] = [];
    const fireballs: Fireball[] = [];
    const spawners: Spawner[] = [];
    const creatures: Creature[] = [];
    const dead: Creature[] = [];

    for (const e of entities) {
      if (e instanceof Fireball) {
        if (e.isAlive) fireballs.push(e);
      } else if (e instanceof Spawner) {
        // Checked before Creature: a Spawner is a Creature subclass.
        if (e.isAlive) spawners.push(e);
      } else if (e instanceof Food) {
        if (e.isAlive) foods.push(e);
      } else if (e instanceof Heart) {
        if (e.isAlive) hearts.push(e);
      } else if (e instanceof ShieldPowerup) {
        if (e.isAlive) shields.push(e);
      } else if (e instanceof SpeedPowerup) {
        if (e.isAlive) speeds.push(e);
      } else if (e instanceof SwordPowerup) {
        if (e.isAlive) swords.push(e);
      } else if (e instanceof Creature) {
        if (e.isAlive) creatures.push(e);
        else dead.push(e);
      }
    }

    for (const f of foods) drawFood(ctx, f, time);
    for (const h of hearts) drawHeart(ctx, h, time);
    for (const p of shields) drawShieldPowerup(ctx, p, time);
    for (const p of speeds) drawSpeedPowerup(ctx, p, time);
    for (const p of swords) drawSwordPowerup(ctx, p, time);
    // Towers sit beneath the creatures milling around them.
    for (const s of spawners) drawSpawner(ctx, s, time);
    for (const c of dead) drawCreature(ctx, c, time);
    for (const c of creatures) drawCreature(ctx, c, time);
    // Fireballs draw on top of everything so they read as active projectiles.
    for (const fb of fireballs) drawFireball(ctx, fb, time);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
