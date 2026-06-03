import { Vec2 } from "../utils/vec2";
import { Entity, World, generateId } from "./entity";

/**
 * A static healing pickup. Any creature that touches it is healed by `healing`
 * HP (capped at its max) and the heart is consumed. Creatures actively seek
 * hearts out when wounded, the same way they seek food when low on energy.
 */
export class Heart implements Entity {
  id: number;
  isAlive = true;
  radius = 8;
  healing: number;
  color: string;
  spawnTime: number;

  constructor(
    public position: Vec2,
    healing = 40,
    color = "#e34",
  ) {
    this.id = generateId();
    this.healing = healing;
    this.color = color;
    this.spawnTime = performance.now();
  }

  update(_dt: number, _world: World) {
    // Hearts are static
  }
}
