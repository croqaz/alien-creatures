import { Game } from "./core/game";
import { Panel } from "./ui/panel";
import { Tooltip } from "./ui/tooltip";
import { mapDimensions } from "./core/map-size";
import { loadMapDocument } from "./core/map-io";
import { getTemplate } from "./templates";
import { showStartModal } from "./ui/start-modal";

const canvas = document.getElementById("game") as HTMLCanvasElement;

// Ask for the map size, shape and template up front, then build the sim. A
// blank map uses the chosen size/shape; a template carries (and restores) its
// own arena, so we build at the default size first and let the load resize it.
showStartModal().then(({ size, shape, template }) => {
  const game = new Game(canvas, mapDimensions(size, shape));
  const panel = new Panel(game);
  const tooltip = new Tooltip(game.camera);

  game.setStatsCallback(() => panel.updateStats());

  const tpl = template ? getTemplate(template) : undefined;
  if (tpl) {
    loadMapDocument(game, tpl.doc);
    // A template is the start of a fresh battle — count seconds from 0, not from
    // whatever elapsed time was baked into the template when it was exported.
    game.time = 0;
    panel.updateStats();
  }

  canvas.addEventListener("mousemove", (e) => {
    tooltip.update(e.clientX, e.clientY, game.entities);
  });

  game.start();
});
