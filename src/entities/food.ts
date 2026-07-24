import { Vec2 } from "../utils/vec2";
import { Entity, generateId, World } from "./entity";

export class Food implements Entity {
  id: number;
  isAlive = true;
  radius = 5;
  nutrition: number;
  color: string;
  spawnTime: number;

  constructor(
    public position: Vec2,
    nutrition = 25,
    color = "#6c3",
  ) {
    this.id = generateId();
    this.nutrition = nutrition;
    this.color = color;
    this.spawnTime = performance.now();
  }

  update(_dt: number, _world: World) {
    // Food is static
  }
}
