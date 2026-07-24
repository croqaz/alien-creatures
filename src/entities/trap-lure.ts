import type { World } from "./entity";
import type { Creature } from "./creature";
import { Food } from "./food";

/**
 * The bait a Trap dangles in its open maw. It's an ordinary piece of Food — so
 * hungry creatures of every other faction are drawn to it exactly as they are to
 * any food — that re-pins itself to its owner's mouth every frame, since the
 * engine has no notion of a moving or carried pickup. It self-destructs the
 * moment its owner dies, so a killed Trap never leaves an orphaned morsel
 * floating on the map. If a victim manages to swallow it, the Trap's behaviour
 * simply spawns a fresh one.
 */
export class TrapLure extends Food {
  constructor(
    private readonly owner: Creature,
    nutrition = 25,
  ) {
    super({ ...owner.position }, nutrition);
  }

  update(_dt: number, _world: World) {
    if (!this.owner.isAlive) {
      this.isAlive = false;
      return;
    }
    // Sit just inside the mouth, which opens along the owner's heading.
    const reach = this.owner.radius * 0.55;
    this.position = {
      x: this.owner.position.x + Math.cos(this.owner.facing) * reach,
      y: this.owner.position.y + Math.sin(this.owner.facing) * reach,
    };
  }
}
