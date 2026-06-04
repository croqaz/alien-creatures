
export class Creature implements Entity {
  id: number;
  species: string;
  faction?: string;
  color: string;
  accentColor: string;
  shape: string;
  radius: number;
  maxSpeed: number;
  health: number;
  // It's possible for a creature to have infinite health,
  // in that case health=Infinity and the creature cannot be damaged
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  // It's possible for a creature to have infinite energy,
  // in that case energy=Infinity and the creature cannot be depleted
  damage: number;
  retaliation?: number;
  perceptionRadius: number;
  behaviours: Behaviour[];
  position: Vec2;
  velocity: Vec2 = vec(0, 0);
  nav = new Navigator();
  // buffs: ...
  // buffTimers: ...

  update(dt: number, world: World): void {
    if (this.health <= 0) return;

    // Energy drain: 1 energy every 10 seconds
    // if (this.energy !== Infinity) {
  }
}
