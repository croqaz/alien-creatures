import { CreativeSpawner } from "../entities/creative-spawner";

/**
 * Draw a Creative Spawner as a squat teal control obelisk: a ground halo, a
 * faceted base, and a rotating diamond core that glows green and spins while a
 * program is running, sitting amber-still when idle. A small pip ring shows how
 * many steps the program has. Indestructible, so it never draws a health bar.
 */
export function drawCreativeSpawner(
  ctx: CanvasRenderingContext2D,
  s: CreativeSpawner,
  time: number,
) {
  const x = s.position.x;
  const y = s.position.y;
  const r = s.radius;
  const pulse = 0.5 + 0.5 * Math.sin(time * 4 + s.id);
  const running = s.running;
  // Running: lively green glow that spins. Idle: calm amber, barely moving.
  const glow = running ? "#39e0a8" : "#e0a83a";

  ctx.save();
  ctx.translate(x, y);

  // Ground glow halo, breathing with the pulse (brighter while running).
  const halo = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4);
  halo.addColorStop(0, rgba(glow, (running ? 0.4 : 0.22) + 0.2 * pulse));
  halo.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Faceted hexagonal base — a dark stone plinth with a teal rim.
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.85;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#10242a";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = s.accentColor;
  ctx.stroke();

  // Rotating diamond core — spins steadily while running, idles slowly.
  ctx.save();
  ctx.rotate(time * (running ? 2.2 : 0.4));
  const cr = r * 0.5 * (running ? 0.9 + 0.18 * pulse : 0.85);
  ctx.beginPath();
  ctx.moveTo(0, -cr);
  ctx.lineTo(cr, 0);
  ctx.lineTo(0, cr);
  ctx.lineTo(-cr, 0);
  ctx.closePath();
  ctx.fillStyle = rgba(glow, 0.7 + 0.3 * pulse);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 12 + 10 * pulse;
  ctx.fill();
  ctx.restore();

  // Pip ring: one dot per program step, arranged around the base.
  const steps = s.program.length;
  if (steps > 0) {
    ctx.fillStyle = rgba(glow, 0.9);
    for (let i = 0; i < steps && i < 24; i++) {
      const a = (i / Math.max(steps, 1)) * Math.PI * 2 - Math.PI / 2;
      // The active step's pip pulses brighter while running.
      const active = running && i === s.stepIndex;
      const pr = active ? 2.6 + 1.2 * pulse : 1.8;
      ctx.beginPath();
      ctx.arc(
        Math.cos(a) * r * 1.18,
        Math.sin(a) * r * 1.0,
        pr,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Expand a #rgb/#rrggbb hex plus alpha into an rgba() string. */
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
