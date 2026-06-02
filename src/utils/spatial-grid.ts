import { Vec2 } from '../utils/vec2';
import type { Entity } from '../entities/entity';

export class SpatialGrid {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private cells: Entity[][];

  constructor(width: number, height: number, cellSize = 200) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = [];
    }
  }

  clear() {
    for (const cell of this.cells) {
      cell.length = 0;
    }
  }

  insert(entity: Entity) {
    const cx = Math.floor(entity.position.x / this.cellSize);
    const cy = Math.floor(entity.position.y / this.cellSize);
    const idx = this.index(cx, cy);
    if (idx !== undefined) {
      this.cells[idx]!.push(entity);
    }
  }

  getNearby(position: Vec2, radius: number): Entity[] {
    const results: Entity[] = [];
    const minCx = Math.floor((position.x - radius) / this.cellSize);
    const maxCx = Math.floor((position.x + radius) / this.cellSize);
    const minCy = Math.floor((position.y - radius) / this.cellSize);
    const maxCy = Math.floor((position.y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const idx = this.index(cx, cy);
        if (idx !== undefined) {
          for (const entity of this.cells[idx]!) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  private index(cx: number, cy: number): number | undefined {
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return undefined;
    return cy * this.cols + cx;
  }
}
