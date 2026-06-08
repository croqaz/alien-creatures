import { Fireball } from "../entities/fireball";
import { Arrow } from "../entities/arrow";

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

/** A slim feathered shaft, drawn pointing along its direction of flight. */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  arrow: Arrow,
  _time: number,
) {
  const { position, velocity } = arrow;
  const angle = Math.atan2(velocity.y, velocity.x);
  const len = 22;
  const half = len / 2;

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);

  // Shaft
  ctx.strokeStyle = "#cba36b";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.lineTo(half, 0);
  ctx.stroke();

  // Arrowhead
  ctx.fillStyle = "#e8e8ee";
  ctx.beginPath();
  ctx.moveTo(half + 4, 0);
  ctx.lineTo(half - 3, -3);
  ctx.lineTo(half - 3, 3);
  ctx.closePath();
  ctx.fill();

  // Fletching at the tail
  ctx.strokeStyle = "#d65";
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(-half - 4, s * 3);
    ctx.stroke();
  }

  ctx.restore();
}
