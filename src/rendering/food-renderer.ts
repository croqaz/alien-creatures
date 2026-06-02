import { Food } from '../entities/food';

export function drawFood(ctx: CanvasRenderingContext2D, food: Food, time: number) {
  if (!food.isAlive) return;

  const { position, radius, color } = food;
  const x = position.x;
  const y = position.y;

  // Pop-in animation
  const age = (performance.now() - food.spawnTime) / 1000;
  const popScale = Math.min(1, age * 4);

  // Gentle glow pulse
  const pulse = 1 + Math.sin(time * 4 + food.id * 2) * 0.15;
  const r = radius * popScale * pulse;

  // Glow
  ctx.beginPath();
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = color + '18';
  ctx.fill();

  // Main dot
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Highlight
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();
}
