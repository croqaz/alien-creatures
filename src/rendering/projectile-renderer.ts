import { Fireball } from "../entities/fireball";
import { Arrow } from "../entities/arrow";
import { LASER_HALF_WIDTH, LASER_LENGTH, LaserBeam } from "../entities/laser";
import { Shockwave } from "../entities/shockwave";

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

/**
 * The Shard of Death's laser. While charging it's a thin crimson telegraph that
 * brightens toward the shot; once firing it's a bright red beam with a white-hot
 * core and a soft outer bloom, flickering so it reads as live energy.
 */
export function drawLaser(
  ctx: CanvasRenderingContext2D,
  beam: LaserBeam,
  time: number,
) {
  ctx.save();
  ctx.translate(beam.position.x, beam.position.y);
  ctx.rotate(beam.angle);

  if (!beam.isFiring) {
    // Telegraph: a thin line that thickens and brightens as the shot charges.
    const a = beam.charge;
    ctx.strokeStyle = `rgba(255, 50, 70, ${0.2 + a * 0.5})`;
    ctx.lineWidth = 1 + a * 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(LASER_LENGTH, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const flicker = 1 + Math.sin(time * 40) * 0.08;
  const half = LASER_HALF_WIDTH * flicker;
  // Outer bloom.
  ctx.fillStyle = "rgba(255, 30, 50, 0.25)";
  ctx.fillRect(0, -half * 2, LASER_LENGTH, half * 4);
  // Beam body.
  ctx.fillStyle = "rgba(255, 45, 65, 0.9)";
  ctx.fillRect(0, -half, LASER_LENGTH, half * 2);
  // Hot white core.
  ctx.fillStyle = "rgba(255, 225, 235, 0.95)";
  ctx.fillRect(0, -half * 0.35, LASER_LENGTH, half * 0.7);
  ctx.restore();
}

/**
 * The Shard of Death's knock-back shockwave: an expanding crimson arc through
 * the boss's rear hemisphere, fading as the front races outward and spends.
 */
export function drawShockwave(
  ctx: CanvasRenderingContext2D,
  wave: Shockwave,
  _time: number,
) {
  const fade = 1 - wave.progress;
  if (fade <= 0) return;

  ctx.save();
  ctx.translate(wave.position.x, wave.position.y);
  ctx.lineCap = "round";
  const a0 = wave.backAngle - Math.PI * 0.6;
  const a1 = wave.backAngle + Math.PI * 0.6;
  for (const [off, w, alpha] of [
    [0, 7, 0.55],
    [-20, 4, 0.3],
  ] as const) {
    const r = wave.radius + off;
    if (r <= 0) continue;
    ctx.strokeStyle = `rgba(255, 60, 90, ${alpha * fade})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.stroke();
  }
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
