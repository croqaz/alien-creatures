import { Creature } from "../entities/creature";
import { magnitude } from "../utils/vec2";

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  time: number,
) {
  const { position, radius, color, accentColor, shape, velocity } = creature;
  const x = position.x;
  const y = position.y;

  // Bobbing animation
  const bob = Math.sin(time * 3 + creature.id * 1.7) * 1.5;

  // Fade on death
  const alive = creature.isAlive;
  if (!alive) {
    const elapsed = (performance.now() - creature.deathTime) / 1000;
    ctx.globalAlpha = Math.max(0, 1 - elapsed * 2);
  }

  ctx.save();
  ctx.translate(x, y + bob);

  // Rotation based on velocity
  const angle = Math.atan2(velocity.y, velocity.x);

  // Draw body
  switch (shape) {
    case "circle":
      drawCircleBody(ctx, radius, color, accentColor);
      break;
    case "oval":
      drawOvalBody(ctx, radius, color, accentColor, angle);
      break;
    case "triangle":
      drawTriangleBody(ctx, radius, color, accentColor, angle);
      break;
    case "rounded-rect":
      drawRoundedRectBody(ctx, radius, color, accentColor, angle);
      break;
    case "spiked":
      drawSpikedBody(ctx, radius, color, accentColor, time, creature.id);
      break;
  }

  // Eyes (look in movement direction)
  const speed = magnitude(velocity);
  const eyeAngle = speed > 5 ? angle : creature.id * 0.5; // idle gaze
  drawEyes(ctx, radius, eyeAngle, shape === "triangle");

  ctx.restore();

  // Health bar (only if damaged)
  if (creature.health < creature.maxHealth && creature.isAlive) {
    drawHealthBar(ctx, x, y - radius - 8, creature.health / creature.maxHealth);
  }

  ctx.globalAlpha = 1;
}

function drawCircleBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawOvalBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
  angle: number,
) {
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawTriangleBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
  angle: number,
) {
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(r * 1.2, 0);
  ctx.lineTo(-r * 0.8, -r * 0.9);
  ctx.lineTo(-r * 0.8, r * 0.9);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRectBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
  angle: number,
) {
  ctx.save();
  ctx.rotate(angle);
  const w = r * 2;
  const h = r * 1.4;
  const cr = 5;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, cr);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawSpikedBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
  time: number,
  id: number,
) {
  const spikes = 8;
  const spikeLen = r * 0.5;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.sin(time * 2 + id) * 0.1;
    const rad = i % 2 === 0 ? r + spikeLen : r;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  r: number,
  angle: number,
  isTriangle: boolean,
) {
  const eyeOffset = isTriangle ? r * 0.3 : r * 0.35;
  const eyeR = Math.max(2.5, r * 0.22);
  const pupilR = eyeR * 0.55;
  const spacing = r * 0.4;

  for (const sign of [-1, 1]) {
    const ex = Math.cos(angle) * eyeOffset - Math.sin(angle) * spacing * sign;
    const ey = Math.sin(angle) * eyeOffset + Math.cos(angle) * spacing * sign;

    // White
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Pupil (looking in direction)
    const px = ex + Math.cos(angle) * pupilR * 0.6;
    const py = ey + Math.sin(angle) * pupilR * 0.6;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  }
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ratio: number,
) {
  const w = 24;
  const h = 3;
  ctx.fillStyle = "#400";
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = ratio > 0.5 ? "#4a4" : ratio > 0.25 ? "#ca4" : "#c44";
  ctx.fillRect(x - w / 2, y, w * ratio, h);
}
