import { ShieldPowerup, SpeedPowerup, SwordPowerup } from "../entities/powerup";

export function drawShieldPowerup(
  ctx: CanvasRenderingContext2D,
  powerup: ShieldPowerup,
  time: number,
) {
  if (!powerup.isAlive) return;

  const { position, radius, color } = powerup;
  const x = position.x;
  const y = position.y;

  // Pop-in animation
  const age = (performance.now() - powerup.spawnTime) / 1000;
  const popScale = Math.min(1, age * 4);

  // Gentle pulse
  const pulse = 1 + Math.sin(time * 3 + powerup.id * 2) * 0.1;
  const r = radius * popScale * pulse;

  // Soft glow
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = color + "22";
  ctx.fill();

  // Shield badge body
  drawShieldPath(ctx, x, y, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner emblem: a smaller shield outline for that "crest" look
  drawShieldPath(ctx, x, y, r * 0.55);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawSpeedPowerup(
  ctx: CanvasRenderingContext2D,
  powerup: SpeedPowerup,
  time: number,
) {
  if (!powerup.isAlive) return;

  const { position, radius, color } = powerup;
  const x = position.x;
  const y = position.y;

  // Pop-in animation
  const age = (performance.now() - powerup.spawnTime) / 1000;
  const popScale = Math.min(1, age * 4);

  // Gentle pulse
  const pulse = 1 + Math.sin(time * 3 + powerup.id * 2) * 0.1;
  const r = radius * popScale * pulse;

  // Soft glow
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = color + "22";
  ctx.fill();

  // Round badge
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Lightning bolt emblem
  const s = r * 0.62;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.25, y - s);
  ctx.lineTo(x - s * 0.45, y + s * 0.1);
  ctx.lineTo(x + s * 0.05, y + s * 0.1);
  ctx.lineTo(x - s * 0.25, y + s);
  ctx.lineTo(x + s * 0.5, y - s * 0.15);
  ctx.lineTo(x - s * 0.02, y - s * 0.15);
  ctx.closePath();
  ctx.fillStyle = "#3a2a00";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawSwordPowerup(
  ctx: CanvasRenderingContext2D,
  powerup: SwordPowerup,
  time: number,
) {
  if (!powerup.isAlive) return;

  const { position, radius, color } = powerup;
  const x = position.x;
  const y = position.y;

  // Pop-in animation
  const age = (performance.now() - powerup.spawnTime) / 1000;
  const popScale = Math.min(1, age * 4);

  // Gentle pulse
  const pulse = 1 + Math.sin(time * 3 + powerup.id * 2) * 0.1;
  const r = radius * popScale * pulse;

  // Soft glow
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = color + "22";
  ctx.fill();

  // Round badge
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sword emblem: a vertical blade with a crossguard and a stubby grip.
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  // Blade
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.lineTo(0, r * 0.45);
  ctx.stroke();
  // Crossguard
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, r * 0.2);
  ctx.lineTo(r * 0.4, r * 0.2);
  ctx.stroke();
  // Pommel
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, r * 0.55, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Trace a heraldic shield centred on (cx, cy), spanning roughly ±r. */
function drawShieldPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  const top = cy - r;
  const w = r * 0.85;
  ctx.beginPath();
  ctx.moveTo(cx - w, top); // top-left
  ctx.lineTo(cx + w, top); // top-right
  ctx.lineTo(cx + w, cy + r * 0.15); // right shoulder
  // Curve down to the pointed base.
  ctx.quadraticCurveTo(cx + w, cy + r * 0.85, cx, cy + r);
  ctx.quadraticCurveTo(cx - w, cy + r * 0.85, cx - w, cy + r * 0.15);
  ctx.closePath();
}
