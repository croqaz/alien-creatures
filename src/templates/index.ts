import openSim from "./open-sim.json";
import miniBattle from "./mini-battle.json";

/**
 * Built-in starting maps offered in the start-up modal. Each template is just a
 * normal exported map document (see map-io) bundled with the app, so it carries
 * its own arena size/shape and full layout — loading one restores it exactly.
 *
 * The JSON files alongside this registry are the editable source of truth: tweak
 * a template by re-exporting a map and dropping the file in here, then add (or
 * update) an entry below. Keep this list small and curated.
 */
export interface MapTemplate {
  /** Stable id used as the modal button's data attribute. */
  readonly key: string;
  readonly label: string;
  readonly description: string;
  /** The raw, parsed map document — handed to loadMapDocument. */
  readonly doc: unknown;
}

export const MAP_TEMPLATES: readonly MapTemplate[] = [
  {
    key: "open-sim",
    label: "Open Sim",
    description:
      "Six spawners ringing a big open square — an evolving free-for-all.",
    doc: openSim,
  },
  {
    key: "mini-battle",
    label: "Mini Battle",
    description: "A compact, walled tall arena set up for a quick skirmish.",
    doc: miniBattle,
  },
];

export function getTemplate(key: string): MapTemplate | undefined {
  return MAP_TEMPLATES.find((t) => t.key === key);
}
