export interface Entity {
  id: number;
  position: Vec2;
  radius: number;
  update(dt: number, world: World): void;
}
