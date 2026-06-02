import { Camera } from "../core/camera";
import { Arena } from "../core/arena";
import { Entity } from "../entities/entity";
import { Creature } from "../entities/creature";
import { Food } from "../entities/food";
import { drawCreature } from "./creature-renderer";
import { drawFood } from "./food-renderer";

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private canvas: HTMLCanvasElement,
    private camera: Camera,
    private arena: Arena,
  ) {}

  render(entities: Entity[], time: number) {
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

    // Sort: food first, then creatures (so creatures draw on top)
    const foods: Food[] = [];
    const creatures: Creature[] = [];
    const dead: Creature[] = [];

    for (const e of entities) {
      if (e instanceof Food) {
        if (e.isAlive) foods.push(e);
      } else if (e instanceof Creature) {
        if (e.isAlive) creatures.push(e);
        else dead.push(e);
      }
    }

    for (const f of foods) drawFood(ctx, f, time);
    for (const c of dead) drawCreature(ctx, c, time);
    for (const c of creatures) drawCreature(ctx, c, time);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
