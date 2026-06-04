export class Creature implements Entity {
  id: number;
  species: string;
  faction?: string;
  color: string;
  accentColor: string;
  shape: ShapeType;
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

  update(dt: number, world: World) {
    // When either health or energy is depleted, the creature cannot perform any actions
    if (this.health <= 0 || this.energy <= 0) return;
    // ...
  }
}
