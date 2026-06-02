import { Camera } from '../core/camera';
import { Creature } from '../entities/creature';
import { Entity } from '../entities/entity';
import { distance } from '../utils/vec2';

export class Tooltip {
  private el: HTMLElement;

  constructor(private camera: Camera) {
    this.el = document.getElementById('tooltip')!;
  }

  update(mouseScreenX: number, mouseScreenY: number, entities: Entity[]) {
    const worldPos = this.camera.screenToWorld({ x: mouseScreenX, y: mouseScreenY });

    let closest: Creature | null = null;
    let closestDist = 30 / this.camera.zoom; // 30 screen pixels tolerance

    for (const e of entities) {
      if (!(e instanceof Creature) || !e.isAlive) continue;
      const d = distance(worldPos, e.position);
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }

    if (closest) {
      this.el.style.display = 'block';
      this.el.style.left = `${mouseScreenX + 14}px`;
      this.el.style.top = `${mouseScreenY + 14}px`;
      this.el.innerHTML = `
        <strong style="color:${closest.color}">${closest.species}</strong><br>
        HP: ${Math.ceil(closest.health)}/${closest.maxHealth}<br>
        Energy: ${Math.ceil(closest.energy)}/${closest.maxEnergy}<br>
        Doing: ${closest.lastActivity}
      `;
    } else {
      this.el.style.display = 'none';
    }
  }
}
