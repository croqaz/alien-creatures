export interface Entity {
  id: number;
  kind: EntityKind;
  position: Vec2;
  radius: number;
  update(dt: number, world: World): void;
}
