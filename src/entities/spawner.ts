import { Entity, EntityKind } from "./entity";
import type { World } from "../core/world";
import type { Vec2 } from "../utils/math";
import { SPAWNER_MAX_HP } from "../core/config";
import { Creature, CreatureSpecies } from "./creature";
import { rand } from "../utils/math";
import { getBehavioursForSpecies } from "../behaviours/index";

export class SpawnerTower implements Entity {
  readonly kind = EntityKind.Spawner;
  id = 0;
  position: Vec2;
  radius = 22;
  spawnSpecies: CreatureSpecies;
  health = SPAWNER_MAX_HP;
  maxHealth = SPAWNER_MAX_HP;
  energy = Infinity;
  maxEnergy = Infinity;
  faction: string;
  private spawnAccum = 0;

  constructor(pos: Vec2, spawnSpecies: CreatureSpecies) {
    this.position = { x: pos.x, y: pos.y };
    this.spawnSpecies = spawnSpecies;
    this.faction = `spawner_${spawnSpecies}_${Math.random().toString(36).slice(2, 7)}`;
  }

  update(dt: number, world: World): void {
    if (this.health <= 0) return;

    // Spawn creatures periodically
    const interval = world.spawnerInterval / 1000; // convert ms to seconds
    if (interval <= 0) return;

    this.spawnAccum += dt;
    while (this.spawnAccum >= interval) {
      this.spawnAccum -= interval;
      this.spawnCreature(world);
    }
  }

  private spawnCreature(world: World): void {
    // Spawn near the tower
    const angle = rand(0, Math.PI * 2);
    const dist = rand(this.radius + 10, this.radius + 40);
    const pos: Vec2 = {
      x: this.position.x + Math.cos(angle) * dist,
      y: this.position.y + Math.sin(angle) * dist,
    };
    const creature = new Creature(
      this.spawnSpecies,
      pos,
      this.faction,
      this.id,
    );
    creature.behaviours = getBehavioursForSpecies(this.spawnSpecies);
    world.spawn(creature);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }
}
