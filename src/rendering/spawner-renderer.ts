import { Spawner } from "../entities/spawner";

/**
 * Draw a Creature Spawner as a tall, tapered tower that glows in the colour of
 * the creature it produces: a ground halo, a dark stone body with lit energy
 * slits, and a pulsing orb at its apex. A health bar appears once it's damaged.
 */
export function drawSpawner(
  ctx: CanvasRenderingContext2D,
  spawner: Spawner,
  time: number,
) {
  const x = spawner.position.x;
  const y = spawner.position.y;
  const r = spawner.radius;
  const H = r * 4.2; // overall tower height
  const baseW = r * 1.9;
  const topW = r * 1.0;
  const pulse = 0.5 + 0.5 * Math.sin(time * 4 + spawner.id);

  const alive = spawner.isAlive;
  if (!alive) {
    const elapsed = (performance.now() - spawner.deathTime) / 1000;
    ctx.globalAlpha = Math.max(0, 1 - elapsed * 2);
  }

  ctx.save();
  ctx.translate(x, y);

  const top = -H / 2;
  const bot = H / 2;

  // Ground glow halo in the creature's colour, breathing with the pulse.
  const halo = ctx.createRadialGradient(
    0,
    bot * 0.4,
    r * 0.4,
    0,
    bot * 0.4,
    r * 2.6,
  );
  halo.addColorStop(0, rgba(spawner.color, 0.35 + 0.25 * pulse));
  halo.addColorStop(1, rgba(spawner.color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, bot * 0.4, r * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Tower body: a tapered stone spire with a pointed roof.
  ctx.beginPath();
  ctx.moveTo(-baseW / 2, bot);
  ctx.lineTo(-topW / 2, top + r * 0.6);
  ctx.lineTo(0, top); // apex
  ctx.lineTo(topW / 2, top + r * 0.6);
  ctx.lineTo(baseW / 2, bot);
  ctx.closePath();
  ctx.fillStyle = "#15151c";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = spawner.accentColor;
  ctx.stroke();

  // Glowing energy slits climbing the tower, widening toward the base.
  ctx.save();
  ctx.fillStyle = rgba(spawner.color, 0.55 + 0.4 * pulse);
  ctx.shadowColor = spawner.color;
  ctx.shadowBlur = 10 + 8 * pulse;
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const sy = top + r * 1.1 + i * (H * 0.24);
    const sw = topW * 0.45 + (baseW - topW) * 0.45 * t;
    ctx.fillRect(-sw / 2, sy, sw, r * 0.26);
  }
  // Pulsing orb at the apex — the spawn "source".
  ctx.beginPath();
  ctx.arc(0, top + r * 0.2, r * 0.5 * (0.85 + 0.25 * pulse), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // Health bar above the tower once it's taken damage.
  if (spawner.health < spawner.maxHealth && alive) {
    const w = Math.max(40, baseW);
    const ratio = spawner.health / spawner.maxHealth;
    const by = y - H / 2 - 10;
    ctx.fillStyle = "#400";
    ctx.fillRect(x - w / 2, by, w, 4);
    ctx.fillStyle = ratio > 0.5 ? "#4a4" : ratio > 0.25 ? "#ca4" : "#c44";
    ctx.fillRect(x - w / 2, by, w * ratio, 4);
  }

  ctx.globalAlpha = 1;
}

/**
 * Convert a #rgb or #rrggbb hex string plus an alpha into an rgba() string.
 * The registry uses short 3-digit colours (e.g. "#4a4"), so expand those.
 */
function rgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
