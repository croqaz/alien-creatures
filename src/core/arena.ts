export class Arena {
  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {}

  draw(ctx: CanvasRenderingContext2D) {
    // Background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid
    const gridSize = 100;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // Border walls
    ctx.strokeStyle = "#446";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.width, this.height);
  }

  clampPosition(
    x: number,
    y: number,
    radius: number,
  ): { x: number; y: number } {
    return {
      x: Math.max(radius, Math.min(this.width - radius, x)),
      y: Math.max(radius, Math.min(this.height - radius, y)),
    };
  }
}
