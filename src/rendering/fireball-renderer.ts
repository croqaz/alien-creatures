import { Fireball } from "../entities/fireball";

/** A glowing, flickering ember with a hot white core and a soft orange halo. */
export function drawFireball(
  ctx: CanvasRenderingContext2D,
  fb: Fireball,
  time: number,
) {
  const { position, radius, id } = fb;
  const flicker = 1 + Math.sin(time * 30 + id) * 0.12;
  const r = radius * flicker;

  ctx.save();
  ctx.translate(position.x, position.y);

  // Outer glow
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2);
  glow.addColorStop(0, "rgba(255, 180, 60, 0.65)");
  glow.addColorStop(1, "rgba(255, 80, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = "#f63";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Hot core
  ctx.fillStyle = "#ffe6a0";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
