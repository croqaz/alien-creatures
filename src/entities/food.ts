import { Entity, EntityKind } from "./entity";
import type { World } from "../core/world";
import type { Vec2 } from "../utils/math";
import { FUEL_ENERGY, HEART_HEAL, AGGRESSIVE_HEART_HEAL } from "../core/config";
import { Creature } from "./creature";

export type FoodType = "fuel" | "health";

export class Food implements Entity {
  readonly kind = EntityKind.Food;
  id = 0;
  position: Vec2;
  radius = 7;
  foodType: FoodType;
  value: number; // energy or health restored
  lifetime: number = Infinity; // seconds; Infinity = permanent
  private age = 0;

  constructor(pos: Vec2, foodType: FoodType) {
    this.position = { x: pos.x, y: pos.y };
    this.foodType = foodType;
    this.value = foodType === "fuel" ? FUEL_ENERGY : HEART_HEAL;
  }

  update(dt: number, world: World): void {
    if (this.lifetime !== Infinity) {
      this.age += dt;
      if (this.age >= this.lifetime) {
        world.remove(this);
        return;
      }
    }

    // Check if any creature is touching this food
    const entities = world.getEntitiesInRadius(this.position, this.radius + 20);
    for (const e of entities) {
      if (e instanceof Creature && e.health > 0) {
        const dx = e.position.x - this.position.x;
        const dy = e.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pickupRange = this.radius + e.radius + 4;

        if (dist <= pickupRange) {
          if (this.foodType === "fuel") {
            e.addEnergy(this.value);
          } else {
            // Aggressive creatures only get half HP from hearts
            const healAmount = e.isAggressive
              ? AGGRESSIVE_HEART_HEAL
              : this.value;
            e.heal(healAmount);
          }
          world.remove(this);
          return;
        }
      }
    }
  }
}
