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

  // Facing direction — rate-limited in Creature.updateFacing so the body
  // pivots smoothly toward its heading instead of snapping/spinning when the
  // velocity vector swings through zero mid-turn.
  const angle = creature.facing;

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

  // Shard of Death aura: an icy-crimson halo so the crystal boss reads as a
  // boss even at full health (its enraged red halo takes over in stage 2).
  if (creature.species === "Shard of Death" && alive) {
    const pulse = 1 + Math.sin(time * 6 + creature.id) * 0.05;
    const ar = radius * 1.35 * pulse;
    const aura = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, ar);
    aura.addColorStop(0, "rgba(120, 220, 245, 0.35)");
    aura.addColorStop(1, "rgba(120, 220, 245, 0)");
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

  // Healer aura: a soft white halo, marking the variant that mends its allies.
  if (creature.isHealer && alive) {
    const pulse = 1 + Math.sin(time * 6 + creature.id) * 0.12;
    const ar = (radius + 10) * 1.4 * pulse;
    const aura = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, ar);
    aura.addColorStop(0, "rgba(245, 255, 245, 0.55)");
    aura.addColorStop(1, "rgba(245, 255, 245, 0)");
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

  // Crust shells (the Shard of Death): concentric crystalline rings around the
  // core, each fading as it's chipped away. Drawn beneath the body so the core
  // sits inside them; the boss physically shrinks as shells shatter and drop out.
  if (creature.crusts.length > 0) {
    drawCrusts(ctx, creature, time);
  }

  // Body draws at the bare core size — for an unarmoured creature that's just
  // its radius; for a crust-bearing boss it's the core inside the shells.
  const bodyR = creature.coreRadius;

  // Draw body
  switch (shape) {
    case "circle":
      drawCircleBody(ctx, bodyR, color, accentColor);
      break;
    case "oval":
      drawOvalBody(ctx, bodyR, color, accentColor, angle);
      break;
    case "triangle":
      drawTriangleBody(ctx, bodyR, color, accentColor, angle);
      break;
    case "rounded-rect":
      drawRoundedRectBody(ctx, bodyR, color, accentColor, angle);
      break;
    case "spiked":
      drawSpikedBody(ctx, bodyR, color, accentColor, time, creature.id);
      break;
    case "pentagon":
      drawPentagonBody(ctx, bodyR, color, accentColor, angle);
      break;
    case "crystal":
      drawCrystalBody(ctx, bodyR, color, accentColor, angle, time, creature.id);
      break;
    case "trap":
      drawTrapBody(ctx, bodyR, color, accentColor, angle, time, creature.id);
      break;
  }

  // Eyes (look in movement direction). The Trap draws its own eyes flanking its
  // maw inside drawTrapBody, so it skips the generic pair here.
  if (shape !== "trap") {
    const speed = magnitude(velocity);
    const eyeAngle = speed > 5 ? angle : creature.id * 0.5; // idle gaze
    drawEyes(ctx, bodyR, eyeAngle, shape === "triangle");
  }

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

/**
 * A faceted crystal with a sharp point along its facing direction (the Shard of
 * Death and its shardlings). Drawn tip-forward so the boss's laser reads as
 * firing from the point; inner ridge lines give it a cut-gem sheen.
 */
function drawCrystalBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
  angle: number,
  time: number,
  id: number,
) {
  ctx.save();
  ctx.rotate(angle);
  // A subtle shimmer so the gem feels alive rather than a static silhouette.
  const shimmer = 1 + Math.sin(time * 2 + id) * 0.03;
  const tip = r * 1.3 * shimmer;
  // Outline, tip toward +x (the facing direction).
  const pts: [number, number][] = [
    [tip, 0],
    [r * 0.4, -r * 0.72],
    [-r * 0.85, -r * 0.46],
    [-r * 1.1, 0],
    [-r * 0.85, r * 0.46],
    [r * 0.4, r * 0.72],
  ];
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1.5, r * 0.02);
  ctx.stroke();

  // Facet ridges from the tip and back point to the shoulders — a cut-gem look.
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, r * 0.012);
  ctx.beginPath();
  ctx.moveTo(tip, 0);
  ctx.lineTo(r * 0.4, -r * 0.72);
  ctx.moveTo(tip, 0);
  ctx.lineTo(r * 0.4, r * 0.72);
  ctx.moveTo(tip, 0);
  ctx.lineTo(-r * 1.1, 0);
  ctx.moveTo(-r * 1.1, 0);
  ctx.lineTo(r * 0.4, -r * 0.72);
  ctx.moveTo(-r * 1.1, 0);
  ctx.lineTo(r * 0.4, r * 0.72);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draw a creature's concentric crust shells (the Shard of Death's armour),
 * innermost outward. Each ring is a translucent crystalline band whose brightness
 * tracks its remaining HP, so a chipped shell visibly dims before it shatters and
 * drops out (shrinking the body). Assumes the canvas is already translated to the
 * creature's centre, as it is in `drawCreature`.
 */
function drawCrusts(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  time: number,
) {
  // `crusts` is outermost-first; walk it in reverse to build radii from the core.
  let inner = creature.coreRadius;
  for (let i = creature.crusts.length - 1; i >= 0; i--) {
    const crust = creature.crusts[i];
    if (!crust) continue;
    const outer = inner + crust.thickness;
    const mid = (inner + outer) / 2;
    const ratio = Math.max(0, crust.hp / crust.maxHp);
    const pulse = 1 + Math.sin(time * 4 + i) * 0.03;

    // Translucent fill across the band, brighter when intact.
    ctx.beginPath();
    ctx.arc(0, 0, outer * pulse, 0, Math.PI * 2);
    ctx.arc(0, 0, inner * pulse, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(150, 225, 245, ${0.06 + 0.16 * ratio})`;
    ctx.fill("evenodd");

    // A crisp edge stroke that fades as the shell is chipped down.
    ctx.beginPath();
    ctx.arc(0, 0, mid * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(214, 0, 90, ${0.25 + 0.55 * ratio})`;
    ctx.lineWidth = crust.thickness * (0.5 + 0.5 * ratio);
    ctx.stroke();

    inner = outer;
  }
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

/**
 * The Trap: a round grey head whose front opens into a dark maw ringed with big
 * sharp white teeth, facing its heading (the bait sits just inside it). A faint
 * idle "breathing" flexes the jaws so it reads as alive while it lies in wait.
 * Draws its own beady eyes flanking the mouth, so the caller skips drawEyes.
 */
function drawTrapBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  accent: string,
  angle: number,
  time: number,
  id: number,
) {
  ctx.save();
  ctx.rotate(angle);

  // Grey skull.
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Gaping maw: a dark wedge opening toward the facing (+x) side, breathing.
  const jaw = 0.85 + Math.sin(time * 3 + id) * 0.08; // half-angle of the opening
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, -jaw, jaw);
  ctx.closePath();
  ctx.fillStyle = "#16161a";
  ctx.fill();

  // Big sharp teeth: white triangles around the rim of the maw, pointing inward.
  const teeth = 7;
  ctx.fillStyle = "#f2f2f5";
  ctx.strokeStyle = "#c2c2cc";
  ctx.lineWidth = 0.5;
  for (let i = 0; i < teeth; i++) {
    const t = -jaw + ((2 * jaw) / (teeth - 1)) * i;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const tipR = r * 0.5; // how far the tooth juts in toward the throat
    const halfBase = ((2 * jaw * r) / teeth) * 0.34; // base half-width along rim
    const rimX = cos * r;
    const rimY = sin * r;
    const tipX = cos * tipR;
    const tipY = sin * tipR;
    // Unit tangent at the rim, to spread the tooth's base.
    const tx = -sin;
    const ty = cos;
    ctx.beginPath();
    ctx.moveTo(rimX + tx * halfBase, rimY + ty * halfBase);
    ctx.lineTo(rimX - tx * halfBase, rimY - ty * halfBase);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Two beady eyes flanking the maw, up on the head.
  for (const sign of [-1, 1]) {
    const ex = r * 0.05;
    const ey = sign * r * 0.62;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + r * 0.05, ey, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  }

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
