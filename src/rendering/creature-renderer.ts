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

  // Enraged aura: a big creature past half health (the boss in stage 2) pulses
  // a menacing red halo so its second phase reads at a glance.
  const enraged =
    radius >= 60 && creature.health <= creature.maxHealth * 0.5 && alive;
  if (enraged) {
    const pulse = 1 + Math.sin(time * 8 + creature.id) * 0.05;
    const ar = radius * 1.5 * pulse;
    const aura = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, ar);
    aura.addColorStop(0, "rgba(220, 30, 30, 0.35)");
    aura.addColorStop(1, "rgba(220, 30, 30, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, ar, 0, Math.PI * 2);
    ctx.fill();
  }

  // Charger aura: the second boss wears a permanent orange halo so its
  // hulking orange frame reads as a boss at a glance, blink or no blink.
  if (creature.species === "Charger" && alive) {
    const pulse = 1 + Math.sin(time * 8 + creature.id) * 0.05;
    const ar = radius * 1.5 * pulse;
    const aura = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, ar);
    aura.addColorStop(0, "rgba(255, 140, 0, 0.4)");
    aura.addColorStop(1, "rgba(255, 140, 0, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, ar, 0, Math.PI * 2);
    ctx.fill();
  }

  // Catapult aura: the third boss wears a permanent purple halo so its hulking
  // purple frame reads as a boss at a glance.
  if (creature.species === "Catapult" && alive) {
    const pulse = 1 + Math.sin(time * 8 + creature.id) * 0.05;
    const ar = radius * 1.5 * pulse;
    const aura = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, ar);
    aura.addColorStop(0, "rgba(150, 60, 230, 0.4)");
    aura.addColorStop(1, "rgba(150, 60, 230, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, ar, 0, Math.PI * 2);
    ctx.fill();
  }

  // Elite aura: a red halo that pulses noticeably, marking the rare 10×-stats
  // variant. Drawn for elites of any size (the boss's enraged halo above is a
  // separate, boss-only effect), and a touch larger/stronger so it stands out.
  if (creature.isElite && alive) {
    const pulse = 1 + Math.sin(time * 6 + creature.id) * 0.12;
    const ar = (radius + 10) * 1.4 * pulse;
    const aura = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, ar);
    aura.addColorStop(0, "rgba(255, 40, 40, 0.5)");
    aura.addColorStop(1, "rgba(255, 40, 40, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, ar, 0, Math.PI * 2);
    ctx.fill();
  }

  // Speed boost: amber streaks trailing behind the direction of travel.
  if (creature.isSpedUp && magnitude(velocity) > 5) {
    const back = angle + Math.PI;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 200, 60, 0.7)";
    ctx.lineWidth = 2;
    for (const off of [-0.45, 0, 0.45]) {
      const a = back + off;
      const sx = Math.cos(a) * radius;
      const sy = Math.sin(a) * radius;
      const len = radius * (off === 0 ? 1.6 : 1.1);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

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
    case "pentagon":
      drawPentagonBody(ctx, radius, color, accentColor, angle);
      break;
  }

  // Eyes (look in movement direction)
  const speed = magnitude(velocity);
  const eyeAngle = speed > 5 ? angle : creature.id * 0.5; // idle gaze
  drawEyes(ctx, radius, eyeAngle, shape === "triangle");

  // Shield bubble: a pulsing translucent dome while the creature is invincible.
  if (creature.isShielded) {
    const pulse = 1 + Math.sin(time * 6 + creature.id) * 0.06;
    const sr = (radius + 6) * pulse;
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(60, 200, 255, 0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 220, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Sword boost: a small red blade glint at the creature's shoulder.
  if (creature.isArmed) {
    const ox = radius * 0.75;
    const oy = -radius * 0.75;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(Math.PI / 4); // angle the blade like a drawn sword
    ctx.lineCap = "round";
    ctx.strokeStyle = "#f55";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.55);
    ctx.lineTo(0, radius * 0.25);
    ctx.stroke();
    ctx.strokeStyle = "#fbb";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.22, radius * 0.12);
    ctx.lineTo(radius * 0.22, radius * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  // Bow: an Archer carries a strung bow at its side, a curved arc with a
  // bowstring, so its ranged role reads at a glance.
  if (creature.isArcher) {
    const bx = radius * 0.85;
    ctx.save();
    ctx.translate(bx, 0);
    ctx.strokeStyle = "#a87232";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, -Math.PI / 2.4, Math.PI / 2.4);
    ctx.stroke();
    // Bowstring between the two tips.
    const ty = Math.sin(Math.PI / 2.4) * radius * 0.7;
    const tx = Math.cos(Math.PI / 2.4) * radius * 0.7;
    ctx.strokeStyle = "rgba(230, 230, 240, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, -ty);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // Health bar (only if damaged). Width scales with body size so the boss's
  // bar isn't a tiny sliver over its huge frame.
  if (creature.health < creature.maxHealth && creature.isAlive) {
    const barW = Math.max(24, radius * 1.4);
    drawHealthBar(
      ctx,
      x,
      y - radius - 8,
      creature.health / creature.maxHealth,
      barW,
    );
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

function drawPentagonBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
  angle: number,
) {
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  const sides = 5;
  for (let i = 0; i < sides; i++) {
    // Start at the top point so the pentagon reads upright before rotation.
    const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    const px = Math.cos(a) * r * 1.15;
    const py = Math.sin(a) * r * 1.15;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
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
  w = 24,
) {
  const h = 3;
  ctx.fillStyle = "#400";
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = ratio > 0.5 ? "#4a4" : ratio > 0.25 ? "#ca4" : "#c44";
  ctx.fillRect(x - w / 2, y, w * ratio, h);
}
