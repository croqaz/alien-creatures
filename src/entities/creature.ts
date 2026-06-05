export type CreatureSpecies =
  | "blob"
  | "floater"
  | "crawler"
  | "defender"
  | "lurker"
  | "spiker";

export class Creature implements Entity {
  readonly kind = EntityKind.Creature;

  id = 0;
  species: CreatureSpecies;
  faction?: string;
  color: string;
  accentColor: string;
  shape: "circle" | "square" | "triangle" | "spiky";
  radius: number;
  maxSpeed: number;
  speed: number; // effective speed
  // It's possible for a creature to have infinite health,
  // in that case health=Infinity and the creature cannot be damaged
  health: number;
  maxHealth: number;
  // It's possible for a creature to have infinite energy,
  // in that case energy=Infinity and the creature cannot be depleted
  energy: number;
  maxEnergy: number;

  damage: number;
  baseDamage: number;
  retaliation: number;
  baseRetaliation: number;
  perceptionRadius: number;

  position: Vec2;
  velocity: Vec2 = vec(0, 0);
  nav = new Navigator();

  // Behaviours – assigned per species
  behaviours: Behaviour[] = [];
  currentAction = "Wandering";
  // Buffs
  activeBuffs: Map<BuffType, number> = new Map();
}
