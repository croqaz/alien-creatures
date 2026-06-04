export interface World {
  entities: Entity[];
  walls: WallGrid;
  spawn(entity: Entity): void;
  arenaWidth: number;
  arenaHeight: number;
  time: number;
}
