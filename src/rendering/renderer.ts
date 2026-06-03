import { Camera } from "../core/camera";
import { Arena } from "../core/arena";
import { Entity } from "../entities/entity";
import { Creature } from "../entities/creature";
import { Food } from "../entities/food";
import { Heart } from "../entities/heart";
import { Wall } from "../entities/wall";
import { drawCreature } from "./creature-renderer";
import { drawFood } from "./food-renderer";
import { drawHeart } from "./heart-renderer";

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
    const creatures: Creature[] = [];
    const dead: Creature[] = [];

    for (const e of entities) {
      if (e instanceof Food) {
        if (e.isAlive) foods.push(e);
      } else if (e instanceof Heart) {
        if (e.isAlive) hearts.push(e);
      } else if (e instanceof Creature) {
        if (e.isAlive) creatures.push(e);
        else dead.push(e);
      }
    }

    for (const f of foods) drawFood(ctx, f, time);
    for (const h of hearts) drawHeart(ctx, h, time);
    for (const c of dead) drawCreature(ctx, c, time);
    for (const c of creatures) drawCreature(ctx, c, time);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
