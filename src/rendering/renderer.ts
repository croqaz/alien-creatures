import { Camera } from "../core/camera";
import { Arena } from "../core/arena";
import { Entity } from "../entities/entity";
import { Creature } from "../entities/creature";
import { Spawner } from "../entities/spawner";
import { CreativeSpawner } from "../entities/creative-spawner";
import { Food } from "../entities/food";
import { TrapLure } from "../entities/trap-lure";
import { Heart } from "../entities/heart";
import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "../entities/powerup";
import { Fireball } from "../entities/fireball";
import { Arrow } from "../entities/arrow";
import { LaserBeam } from "../entities/laser";
import { Shockwave } from "../entities/shockwave";
import { Wall } from "../entities/wall";
import { drawCreature } from "./creature-renderer";
import { drawSpawner } from "./spawner-renderer";
import { drawCreativeSpawner } from "./creative-spawner-renderer";
import { drawFood } from "./food-renderer";
import { drawHeart } from "./heart-renderer";
import {
  drawArrow,
  drawFireball,
  drawLaser,
  drawShockwave,
} from "./projectile-renderer";
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

  render(
    entities: Entity[],
    walls: Wall[],
    time: number,
    selected: Creature | null = null,
  ) {
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

    // Draw blocks (beneath food and creatures). Stone is the old slate-grey
    // wall; dirt is an earthy brown. A block that's been dug into darkens and
    // shows a thin damage bar so its remaining health reads at a glance.
    for (const w of walls) {
      const x = w.position.x - w.size / 2;
      const y = w.position.y - w.size / 2;
      const isDirt = w.type === "dirt";
      ctx.fillStyle = isDirt ? "#6b4a2b" : "#3a3a52";
      ctx.fillRect(x, y, w.size, w.size);
      ctx.strokeStyle = isDirt ? "#8a6238" : "#5a5a7a";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w.size - 2, w.size - 2);

      const ratio = w.hp / w.maxHp;
      if (ratio < 1) {
        // Darkening shroud over the chewed-away portion.
        ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * (1 - ratio)})`;
        ctx.fillRect(x, y, w.size, w.size);
        // Damage bar hugging the bottom edge of the tile.
        const bw = w.size - 6;
        ctx.fillStyle = "#000";
        ctx.fillRect(x + 3, y + w.size - 6, bw, 3);
        ctx.fillStyle = ratio > 0.5 ? "#6c6" : ratio > 0.25 ? "#cc4" : "#c54";
        ctx.fillRect(x + 3, y + w.size - 6, bw * ratio, 3);
      }
    }

    // Sort: pickups (food/hearts) first, then creatures (so creatures draw on top)
    const foods: Food[] = [];
    // A Trap's bait sits inside its body, so it's drawn after the creatures
    // (over the maw) rather than with the other food beneath them.
    const trapLures: TrapLure[] = [];
    const hearts: Heart[] = [];
    const shields: ShieldPowerup[] = [];
    const speeds: SpeedPowerup[] = [];
    const swords: SwordPowerup[] = [];
    const fireballs: Fireball[] = [];
    const arrows: Arrow[] = [];
    const lasers: LaserBeam[] = [];
    const shockwaves: Shockwave[] = [];
    const spawners: Spawner[] = [];
    const creativeSpawners: CreativeSpawner[] = [];
    const creatures: Creature[] = [];
    const dead: Creature[] = [];

    for (const e of entities) {
      if (e instanceof Arrow) {
        // Checked before Fireball: an Arrow is a Fireball subclass.
        if (e.isAlive) arrows.push(e);
      } else if (e instanceof Fireball) {
        if (e.isAlive) fireballs.push(e);
      } else if (e instanceof LaserBeam) {
        if (e.isAlive) lasers.push(e);
      } else if (e instanceof Shockwave) {
        if (e.isAlive) shockwaves.push(e);
      } else if (e instanceof CreativeSpawner) {
        // Checked before Spawner/Creature: it's a Creature subclass too.
        if (e.isAlive) creativeSpawners.push(e);
      } else if (e instanceof Spawner) {
        // Checked before Creature: a Spawner is a Creature subclass.
        if (e.isAlive) spawners.push(e);
      } else if (e instanceof TrapLure) {
        // Checked before Food: a TrapLure is a Food subclass.
        if (e.isAlive) trapLures.push(e);
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
    for (const s of creativeSpawners) drawCreativeSpawner(ctx, s, time);
    for (const c of dead) drawCreature(ctx, c, time);
    for (const c of creatures) drawCreature(ctx, c, time);
    // Trap bait sits on top of the Trap's body so it's visible inside the maw.
    for (const l of trapLures) drawFood(ctx, l, time);
    // Projectiles and boss attacks draw on top of everything so they read as
    // active threats. Shockwaves go down first (a ground-level pulse), then the
    // beams and projectiles over them.
    for (const w of shockwaves) drawShockwave(ctx, w, time);
    for (const fb of fireballs) drawFireball(ctx, fb, time);
    for (const a of arrows) drawArrow(ctx, a, time);
    for (const l of lasers) drawLaser(ctx, l, time);

    // Selection ring: a pulsing dashed circle around the Select tool's pick.
    if (selected && selected.isAlive) {
      const r = selected.radius + 7;
      ctx.save();
      ctx.translate(selected.position.x, selected.position.y);
      ctx.rotate(time * 1.5);
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
