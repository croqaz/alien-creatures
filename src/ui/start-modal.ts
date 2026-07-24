import {
  DEFAULT_MAP_SHAPE,
  DEFAULT_MAP_SIZE,
  mapDimensions,
  type MapShapeKey,
  type MapSizeKey,
} from "../core/map-size";
import { MAP_TEMPLATES } from "../templates";

/** The choices the user makes in the start-up modal before the sim is built. */
export interface StartOptions {
  size: MapSizeKey;
  shape: MapShapeKey;
  /** Chosen template key, or null for a blank map at the picked size/shape. */
  template: string | null;
}

/**
 * Show the start-up configuration modal and resolve once the user presses Start.
 *
 * Map size and shape are live and cross-reference each other's dimension hints.
 * The template list is generated from the registry (so adding a template is a
 * registry-only change). Picking a template overrides size/shape — a template
 * carries its own arena — so those sections are visibly suppressed while one is
 * selected.
 */
export function showStartModal(): Promise<StartOptions> {
  return new Promise((resolve) => {
    const overlay = document.getElementById("start-modal")!;
    const startBtn = document.getElementById("start-btn")!;
    const sizeButtons = Array.from(
      overlay.querySelectorAll<HTMLButtonElement>(".size-btn"),
    );
    const shapeButtons = Array.from(
      overlay.querySelectorAll<HTMLButtonElement>(".shape-btn"),
    );
    const geometrySections = Array.from(
      overlay.querySelectorAll<HTMLElement>(".geometry-section"),
    );

    let size: MapSizeKey = DEFAULT_MAP_SIZE;
    let shape: MapShapeKey = DEFAULT_MAP_SHAPE;
    let template: string | null = null;

    const templateButtons = buildTemplateButtons(overlay);

    // Re-render selection state and the live dimension hints. Each size button
    // shows its dims at the current shape; each shape button shows its dims at
    // the current size — so the numbers always preview the pending arena.
    const refresh = () => {
      for (const btn of sizeButtons) {
        const key = btn.dataset.size as MapSizeKey;
        btn.classList.toggle("active", key === size);
        const hint = btn.querySelector<HTMLElement>(".dim-hint");
        if (hint) {
          const d = mapDimensions(key, shape);
          hint.textContent = `${d.width}×${d.height}`;
        }
      }
      for (const btn of shapeButtons) {
        const key = btn.dataset.shape as MapShapeKey;
        btn.classList.toggle("active", key === shape);
        const hint = btn.querySelector<HTMLElement>(".dim-hint");
        if (hint) {
          const d = mapDimensions(size, key);
          hint.textContent = `${d.width}×${d.height}`;
        }
      }
      for (const btn of templateButtons) {
        // The Blank option carries an empty data-template; treat it as null.
        const key = btn.dataset.template || null;
        btn.classList.toggle("active", key === template);
      }
      // A template owns its arena, so size/shape don't apply while one is picked.
      for (const section of geometrySections) {
        section.classList.toggle("suppressed", template !== null);
      }
    };

    for (const btn of sizeButtons) {
      btn.addEventListener("click", () => {
        size = (btn.dataset.size as MapSizeKey) ?? DEFAULT_MAP_SIZE;
        refresh();
      });
    }
    for (const btn of shapeButtons) {
      btn.addEventListener("click", () => {
        shape = (btn.dataset.shape as MapShapeKey) ?? DEFAULT_MAP_SHAPE;
        refresh();
      });
    }
    for (const btn of templateButtons) {
      btn.addEventListener("click", () => {
        template = btn.dataset.template || null;
        refresh();
      });
    }
    refresh();

    startBtn.addEventListener("click", () => {
      overlay.setAttribute("hidden", "");
      resolve({ size, shape, template });
    });
  });
}

/**
 * Populate the template picker from the registry: a "Blank" option (selected by
 * default) followed by one row per built-in template. Returns all the buttons so
 * the caller can wire up selection.
 */
function buildTemplateButtons(overlay: HTMLElement): HTMLButtonElement[] {
  const container = overlay.querySelector<HTMLElement>("#template-options")!;
  container.innerHTML = "";

  const make = (key: string, label: string, desc: string, active: boolean) => {
    const btn = document.createElement("button");
    btn.className = "template-btn" + (active ? " active" : "");
    btn.dataset.template = key;
    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent = label;
    const d = document.createElement("span");
    d.className = "tpl-desc";
    d.textContent = desc;
    btn.append(name, d);
    container.appendChild(btn);
    return btn;
  };

  const buttons = [
    make("", "Blank", "Empty map at the size and shape above.", true),
  ];
  for (const t of MAP_TEMPLATES) {
    buttons.push(make(t.key, t.label, t.description, false));
  }
  return buttons;
}
