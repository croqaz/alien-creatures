import { Vec2, vec, sub, add } from '../utils/vec2';

export class Camera {
  offset: Vec2 = vec(0, 0);
  zoom = 1;

  private readonly minZoom = 0.15;
  private readonly maxZoom = 5;

  worldToScreen(point: Vec2): Vec2 {
    return {
      x: (point.x + this.offset.x) * this.zoom,
      y: (point.y + this.offset.y) * this.zoom,
    };
  }

  screenToWorld(screen: Vec2): Vec2 {
    return {
      x: screen.x / this.zoom - this.offset.x,
      y: screen.y / this.zoom - this.offset.y,
    };
  }

  applyTransform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.offset.x * this.zoom, this.offset.y * this.zoom);
  }

  pan(dx: number, dy: number) {
    this.offset = add(this.offset, vec(dx / this.zoom, dy / this.zoom));
  }

  zoomAt(screen: Vec2, delta: number) {
    const worldBefore = this.screenToWorld(screen);
    const factor = delta > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const worldAfter = this.screenToWorld(screen);
    this.offset = add(this.offset, sub(worldAfter, worldBefore));
  }

  centerOn(worldPoint: Vec2, canvasWidth: number, canvasHeight: number) {
    this.offset = vec(
      canvasWidth / (2 * this.zoom) - worldPoint.x,
      canvasHeight / (2 * this.zoom) - worldPoint.y,
    );
  }
}
