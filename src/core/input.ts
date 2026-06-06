import { Camera } from "./camera";
import { vec, Vec2 } from "../utils/vec2";

export type ClickHandler = (worldPos: Vec2) => void;

export class Input {
  private isPanning = false;
  private isPainting = false;
  private lastMouse: Vec2 = vec(0, 0);
  mouse: Vec2 = vec(0, 0);
  /** Fired on left press and on every left-drag move (paint/grab/move). */
  onClick: ClickHandler | null = null;
  /** Fired once when a left press/drag ends, so tools can finish a gesture (e.g. drop a dragged creature). */
  onRelease: ClickHandler | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("mouseleave", this.onMouseUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onMouseDown = (e: MouseEvent) => {
    // Right or middle button → pan
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastMouse = vec(e.clientX, e.clientY);
      this.canvas.classList.add("panning");
      return;
    }
    // Left button → delegate to handler; hold-and-drag keeps firing (paint).
    if (e.button === 0 && this.onClick) {
      this.isPainting = true;
      this.onClick(this.camera.screenToWorld(vec(e.clientX, e.clientY)));
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    this.mouse = vec(e.clientX, e.clientY);
    if (this.isPanning) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.camera.pan(dx, dy);
      this.lastMouse = vec(e.clientX, e.clientY);
    } else if (this.isPainting && this.onClick) {
      this.onClick(this.camera.screenToWorld(vec(e.clientX, e.clientY)));
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    // A left press/drag is ending: let the active tool finish its gesture
    // (Move uses this to drop the creature it was dragging).
    if (this.isPainting && this.onRelease) {
      this.onRelease(this.camera.screenToWorld(vec(e.clientX, e.clientY)));
    }
    this.isPanning = false;
    this.isPainting = false;
    this.canvas.classList.remove("panning");
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.camera.zoomAt(vec(e.clientX, e.clientY), e.deltaY);
  };
}
