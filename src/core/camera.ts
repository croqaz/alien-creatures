import { add, sub, vec, Vec2 } from "../utils/vec2";

export class Camera {
  offset: Vec2 = vec(0, 0);
  zoom = 1;

  private readonly minZoom = 0.1;
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
    ctx.setTransform(
      this.zoom,
      0,
      0,
      this.zoom,
      this.offset.x * this.zoom,
      this.offset.y * this.zoom,
    );
  }

  pan(dx: number, dy: number) {
    this.offset = add(this.offset, vec(dx / this.zoom, dy / this.zoom));
  }

  zoomAt(screen: Vec2, delta: number) {
    const worldBefore = this.screenToWorld(screen);
    const factor = delta > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, this.zoom * factor),
    );
    const worldAfter = this.screenToWorld(screen);
    this.offset = add(this.offset, sub(worldAfter, worldBefore));
  }

  centerOn(worldPoint: Vec2, canvasWidth: number, canvasHeight: number) {
    this.offset = vec(
      canvasWidth / (2 * this.zoom) - worldPoint.x,
      canvasHeight / (2 * this.zoom) - worldPoint.y,
    );
  }

  /**
   * Frame the whole world (worldWidth × worldHeight) in the viewport: pick the
   * largest zoom that fits both axes with a little breathing room, clamped to
   * the zoom limits, then centre on the middle. Used on startup so the chosen
   * map is fully visible without manual panning/zooming.
   */
  fitTo(
    worldWidth: number,
    worldHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    padding = 40,
  ) {
    const fitX = (canvasWidth - padding * 2) / worldWidth;
    const fitY = (canvasHeight - padding * 2) / worldHeight;
    this.zoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, Math.min(fitX, fitY)),
    );
    this.centerOn(
      { x: worldWidth / 2, y: worldHeight / 2 },
      canvasWidth,
      canvasHeight,
    );
  }
}
