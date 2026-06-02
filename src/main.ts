import { Game } from "./core/game";
import { Panel } from "./ui/panel";
import { Tooltip } from "./ui/tooltip";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const game = new Game(canvas);
const panel = new Panel(game);
const tooltip = new Tooltip(game.camera);

game.setStatsCallback(() => panel.updateStats());

canvas.addEventListener("mousemove", (e) => {
  tooltip.update(e.clientX, e.clientY, game.entities);
});

game.start();
