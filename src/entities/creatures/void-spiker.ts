import { Vec2 } from "../../utils/vec2";
import { Creature } from "../creature";
import { AggressiveBehaviour } from "../../behaviours/aggressive";

/**
 * Shared allegiance of the boss and everything it summons. Members never harm
 * one another and won't hunt each other; everyone outside the faction is fair
 * game. Lives here (not in the boss behaviour) so both the registry and the
 * boss can reference it without an import cycle.
 */
export const VOID_FACTION = "void";

/**
 * A Void Spiker: the boss's loyal minion. A fast, aggressive black spiker that
 * attacks every creature outside the void faction but is loyal to the boss and
 * its fellow spikers. Defined as a standalone factory so the boss behaviour can
 * summon them mid-fight and the registry can offer them for manual spawning.
 */
export function createVoidSpiker(pos: Vec2): Creature {
  return new Creature(pos, {
    species: "Void Spiker",
    color: "#16161f",
    accentColor: "#a33",
    shape: "spiked",
    radius: 15,
    maxSpeed: 95,
    maxHealth: 120,
    maxEnergy: 100,
    damage: 30,
    perceptionRadius: 300,
    behaviour: new AggressiveBehaviour(),
    faction: VOID_FACTION,
  });
}
