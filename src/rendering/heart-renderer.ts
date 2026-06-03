import { Heart } from "../entities/heart";

export function drawHeart(
  ctx: CanvasRenderingContext2D,
  heart: Heart,
  time: number,
) {
  if (!heart.isAlive) return;

  const { position, radius, color } = heart;
  const x = position.x;
  const y = position.y;

  // Pop-in animation
  const age = (performance.now() - heart.spawnTime) / 1000;
  const popScale = Math.min(1, age * 4);

  // Gentle heartbeat pulse
  const pulse = 1 + Math.sin(time * 4 + heart.id * 2) * 0.12;
  const r = radius * popScale * pulse;

  // Soft glow
  ctx.beginPath();
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color + "22";
  ctx.fill();

  // Heart shape, sized to roughly fit within radius r.
  drawHeartPath(ctx, x, y, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Highlight on the upper-left lobe
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fill();
}

/** Trace a classic two-lobe heart centred on (cx, cy) spanning roughly ±r. */
function drawHeartPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  const s = r / 1.1; // scale the unit heart to the requested radius
  ctx.beginPath();
  // Start at the bottom tip.
  ctx.moveTo(cx, cy + s * 0.95);
  // Left side up to the left lobe.
  ctx.bezierCurveTo(
    cx - s * 1.2,
    cy + s * 0.15,
    cx - s * 1.05,
    cy - s * 0.9,
    cx,
    cy - s * 0.25,
  );
  // Right lobe back down to the tip.
  ctx.bezierCurveTo(
    cx + s * 1.05,
    cy - s * 0.9,
    cx + s * 1.2,
    cy + s * 0.15,
    cx,
    cy + s * 0.95,
  );
  ctx.closePath();
}
